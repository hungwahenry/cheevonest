import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  extractOtpCode,
  seedInterests,
  TestContext,
  uniqueEmail,
} from './create-test-app';

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Onboarding & profile (e2e)', () => {
  let ctx: TestContext;
  let interestIds: number[];

  const server = () => ctx.app.getHttpServer();

  const signIn = async (email: string): Promise<string> => {
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);

    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const completeProfile = (token: string, username: string) =>
    request(server())
      .post('/api/v1/onboarding/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        first_name: 'Ada',
        last_name: 'Obi',
        username,
        gender: 'female',
        date_of_birth: '2000-01-15',
        latitude: 6.5243793,
        longitude: 3.3792057,
        place_name: 'Lekki Phase 1',
        city: 'Lagos',
        interests: interestIds.slice(0, 3),
        bio: 'Party lover',
        marketing_opt_in: true,
      });

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedInterests(ctx.prisma);

    const interests = await ctx.prisma.interest.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    interestIds = interests.map((interest) => interest.id);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('lists active interests', async () => {
    const token = await signIn(uniqueEmail('interests'));

    const response = await request(server())
      .get('/api/v1/interests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = response.body as {
      data: Array<{ id: number; slug: string; name: string }>;
    };
    expect(body.data.length).toBe(30);
    expect(body.data[0]).toEqual({
      id: interestIds[0],
      slug: 'afrobeats',
      name: 'Afrobeats',
    });
  });

  it('checks username availability', async () => {
    const token = await signIn(uniqueEmail('username'));

    const available = await request(server())
      .get('/api/v1/onboarding/username-available?username=fresh_name')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(available.body).toMatchObject({
      data: { username: 'fresh_name', available: true },
    });

    await request(server())
      .get('/api/v1/onboarding/username-available?username=AB')
      .set('Authorization', `Bearer ${token}`)
      .expect(422);
  });

  it('completes onboarding atomically', async () => {
    const email = uniqueEmail('onboard');
    const token = await signIn(email);
    const username = `ada_${Date.now().toString(36)}`;

    const response = await completeProfile(token, username).expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      message: 'Profile complete. Welcome!',
      data: {
        onboarding_completed: true,
        profile: {
          first_name: 'Ada',
          last_name: 'Obi',
          username,
          gender: 'female',
          date_of_birth: '2000-01-15',
          city: 'Lagos',
          place_name: 'Lekki Phase 1',
          latitude: '6.5243793',
          longitude: '3.3792057',
          marketing_opt_in: true,
          completed: true,
        },
      },
    });

    const body = response.body as { data: { interests: unknown[] } };
    expect(body.data.interests).toHaveLength(3);
  });

  it('rejects a taken username at onboarding', async () => {
    const username = `taken_${Date.now().toString(36)}`;
    const first = await signIn(uniqueEmail('first'));
    await completeProfile(first, username).expect(200);

    const second = await signIn(uniqueEmail('second'));
    const response = await completeProfile(second, username).expect(422);

    expect(
      (response.body as { errors: Record<string, string[]> }).errors.username,
    ).toEqual(['The username has already been taken.']);
  });

  it('links a referral and uploads an avatar via multipart', async () => {
    const referrerToken = await signIn(uniqueEmail('referrer'));
    const referrerUsername = `ref_${Date.now().toString(36)}`;
    const referrer = await completeProfile(
      referrerToken,
      referrerUsername,
    ).expect(200);
    const referralCode = (
      referrer.body as { data: { profile: { referral_code: string } } }
    ).data.profile.referral_code;

    const email = uniqueEmail('referred');
    const token = await signIn(email);

    const response = await request(server())
      .post('/api/v1/onboarding/profile')
      .set('Authorization', `Bearer ${token}`)
      .field('first_name', 'Bola')
      .field('last_name', 'Ade')
      .field('username', `bola_${Date.now().toString(36)}`)
      .field('gender', 'male')
      .field('date_of_birth', '1999-06-09')
      .field('latitude', '6.45')
      .field('longitude', '3.39')
      .field('place_name', 'Victoria Island')
      .field('interests[]', String(interestIds[0]))
      .field('interests[]', String(interestIds[1]))
      .field('referral_code', referralCode)
      .attach('avatar', PNG_PIXEL, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(200);

    const profile = (
      response.body as { data: { profile: { avatar_url: string } } }
    ).data.profile;
    expect(profile.avatar_url).toContain('/storage/avatars/');

    const stored = await ctx.prisma.profile.findFirst({
      where: { user: { email } },
    });
    expect(stored?.avatarPath).toMatch(/^local:avatars\//);
    expect(stored?.referredByUserId).not.toBeNull();
  });

  it('updates profile fields partially', async () => {
    const email = uniqueEmail('update');
    const token = await signIn(email);
    await completeProfile(token, `upd_${Date.now().toString(36)}`).expect(200);

    const response = await request(server())
      .patch('/api/v1/attendee/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: null, city: 'Abuja' })
      .expect(200);

    expect(response.body).toMatchObject({
      message: 'Profile updated.',
      data: { profile: { bio: null, city: 'Abuja' } },
    });
  });

  it('replaces interests', async () => {
    const email = uniqueEmail('swap');
    const token = await signIn(email);
    await completeProfile(token, `swap_${Date.now().toString(36)}`).expect(200);

    const response = await request(server())
      .patch('/api/v1/attendee/interests')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: [interestIds[5]] })
      .expect(200);

    const body = response.body as { data: Array<{ id: number }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(interestIds[5]);

    await request(server())
      .patch('/api/v1/attendee/interests')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: [999999] })
      .expect(422);
  });
});
