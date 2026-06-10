import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  extractOtpCode,
  TestContext,
  uniqueEmail,
} from './create-test-app';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  const server = () => ctx.app.getHttpServer();

  const signIn = async (email: string): Promise<string> => {
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);

    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('sends an OTP without leaking account existence', async () => {
    const response = await request(server())
      .post('/api/v1/auth/send-otp')
      .send({ email: uniqueEmail('send') })
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      message: 'If that email can receive codes, one is on its way.',
      data: null,
    });
    expect(ctx.mails.at(-1)?.template).toBe('otp-code');
  });

  it('enforces the resend cooldown', async () => {
    const email = uniqueEmail('cooldown');

    await request(server())
      .post('/api/v1/auth/send-otp')
      .send({ email })
      .expect(200);

    const response = await request(server())
      .post('/api/v1/auth/send-otp')
      .send({ email })
      .expect(429);

    expect(response.body).toMatchObject({
      status: 'error',
      code: 'otp_throttled',
      message: 'Please wait before requesting another code.',
    });
    expect(
      (response.body as { errors: { retry_after_seconds: number } }).errors
        .retry_after_seconds,
    ).toBeGreaterThan(0);
  });

  it('rejects an invalid code', async () => {
    const email = uniqueEmail('invalid');

    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const wrong = code === '000000' ? '111111' : '000000';

    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: wrong })
      .expect(422);

    expect(response.body).toMatchObject({
      status: 'error',
      code: 'otp_invalid',
      message: 'The code you entered is incorrect.',
    });
  });

  it('locks the code after too many incorrect attempts', async () => {
    const email = uniqueEmail('attempts');

    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(server())
        .post('/api/v1/auth/verify-otp')
        .send({ email, code: wrong })
        .expect(422);
    }

    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code })
      .expect(429);

    expect(response.body).toMatchObject({ code: 'otp_max_attempts' });
  });

  it('signs up a new user on first verification', async () => {
    const email = uniqueEmail('signup');

    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);

    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code })
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      message: 'Welcome to cheevo!',
      data: {
        is_new_user: true,
        user: {
          email,
          role: 'attendee',
          email_verified: true,
          onboarding_completed: false,
          is_organizer: false,
          organisations: [],
          interests: [],
        },
      },
    });

    const body = response.body as {
      data: { token: string; user: { profile: { referral_code: string } } };
    };
    expect(body.data.token).toContain('|');
    expect(body.data.user.profile.referral_code).toHaveLength(8);
  });

  it('logs an existing user back in', async () => {
    const email = uniqueEmail('login');
    await signIn(email);

    await ctx.prisma.otpCode.deleteMany({ where: { email } });
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);

    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code })
      .expect(200);

    expect(response.body).toMatchObject({
      message: 'Welcome back!',
      data: { is_new_user: false },
    });
  });

  it('serves /auth/me and invalidates the token on logout', async () => {
    const email = uniqueEmail('me');
    const token = await signIn(email);

    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body).toMatchObject({ data: { email } });

    await request(server())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterLogout = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(afterLogout.body).toMatchObject({
      status: 'error',
      code: 'unauthenticated',
      message: 'Unauthenticated.',
    });
  });

  it('blocks suspended users with a 403', async () => {
    const email = uniqueEmail('suspended');
    const token = await signIn(email);

    await ctx.prisma.user.update({
      where: { email },
      data: { suspendedAt: new Date(), suspendedReason: 'test' },
    });

    const response = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      code: 'forbidden',
      message: 'Your account has been suspended.',
    });
  });

  it('rejects malformed payloads with the validation envelope', async () => {
    const response = await request(server())
      .post('/api/v1/auth/send-otp')
      .send({})
      .expect(422);

    expect(response.body).toMatchObject({
      status: 'error',
      code: 'validation_failed',
      message: 'The given data was invalid.',
    });
    expect(
      (response.body as { errors: Record<string, string[]> }).errors.email,
    ).toBeDefined();
  });

  it('requires authentication for protected routes', async () => {
    await request(server()).get('/api/v1/auth/me').expect(401);
    await request(server()).get('/api/v1/interests').expect(401);
  });
});
