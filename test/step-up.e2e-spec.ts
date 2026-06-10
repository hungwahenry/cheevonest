import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  extractOtpCode,
  seedCatalog,
  seedInterests,
  seedPlatform,
  TestContext,
  uniqueEmail,
} from './create-test-app';

describe('Step-up flows (e2e)', () => {
  let ctx: TestContext;

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;

  const signIn = async (email: string): Promise<string> => {
    await ctx.prisma.otpCode.deleteMany({ where: { email } });
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const lastCodeFor = (email: string): string => {
    const mail = [...ctx.mails]
      .reverse()
      .find((message) => message.to === email);

    expect(mail).toBeDefined();

    return extractOtpCode(mail!);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('changes email through the dual-otp flow and revokes other sessions', async () => {
    const currentEmail = uniqueEmail('stepup-change');
    const newEmail = uniqueEmail('stepup-new');
    const token = await signIn(currentEmail);
    const otherSession = await signIn(currentEmail);

    const created = await request(server())
      .post('/api/v1/step-up')
      .set('Authorization', auth(token))
      .send({ action: 'change_email', payload: { new_email: newEmail } })
      .expect(200);

    const challenge = (
      created.body as {
        data: {
          id: string;
          completed: boolean;
          next_factor_id: string;
          factors: Array<{
            id: string;
            target_masked: string;
            verified: boolean;
          }>;
        };
      }
    ).data;

    expect(challenge.completed).toBe(false);
    expect(challenge.factors).toHaveLength(2);
    expect(challenge.factors[0].target_masked).toContain('@');
    expect(challenge.factors[0].target_masked).toContain('*');

    const firstCode = lastCodeFor(currentEmail);

    const wrong = await request(server())
      .post(`/api/v1/step-up/${challenge.id}/verify`)
      .set('Authorization', auth(token))
      .send({ factor_id: challenge.next_factor_id, code: '000000' })
      .expect(422);
    expect(wrong.body).toMatchObject({ code: 'otp_invalid' });

    const afterFirst = await request(server())
      .post(`/api/v1/step-up/${challenge.id}/verify`)
      .set('Authorization', auth(token))
      .send({ factor_id: challenge.next_factor_id, code: firstCode })
      .expect(200);

    const midway = (
      afterFirst.body as {
        data: { completed: boolean; next_factor_id: string };
      }
    ).data;
    expect(midway.completed).toBe(false);
    expect(midway.next_factor_id).not.toBe(challenge.next_factor_id);

    const skipAhead = await request(server())
      .post(`/api/v1/step-up/${challenge.id}/verify`)
      .set('Authorization', auth(token))
      .send({ factor_id: challenge.next_factor_id, code: '123456' })
      .expect(409);
    expect(skipAhead.body).toMatchObject({ code: 'step_up_wrong_factor' });

    const secondCode = lastCodeFor(newEmail);

    const completed = await request(server())
      .post(`/api/v1/step-up/${challenge.id}/verify`)
      .set('Authorization', auth(token))
      .send({ factor_id: midway.next_factor_id, code: secondCode })
      .expect(200);

    expect(completed.body).toMatchObject({
      data: {
        completed: true,
        result: { user: { email: newEmail } },
      },
    });

    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(token))
      .expect(200);
    expect(me.body).toMatchObject({ data: { email: newEmail } });

    await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(otherSession))
      .expect(401);

    const replay = await request(server())
      .post(`/api/v1/step-up/${challenge.id}/verify`)
      .set('Authorization', auth(token))
      .send({ factor_id: midway.next_factor_id, code: secondCode })
      .expect(409);
    expect(replay.body).toMatchObject({ code: 'step_up_completed' });
  });

  it('rejects bad change-email payloads', async () => {
    const email = uniqueEmail('stepup-guard');
    const token = await signIn(email);
    const takenEmail = uniqueEmail('stepup-taken');
    await signIn(takenEmail);

    const same = await request(server())
      .post('/api/v1/step-up')
      .set('Authorization', auth(token))
      .send({ action: 'change_email', payload: { new_email: email } })
      .expect(422);
    expect(same.body).toMatchObject({ code: 'email_same' });

    const taken = await request(server())
      .post('/api/v1/step-up')
      .set('Authorization', auth(token))
      .send({ action: 'change_email', payload: { new_email: takenEmail } })
      .expect(422);
    expect(taken.body).toMatchObject({ code: 'email_taken' });

    await request(server())
      .post('/api/v1/step-up')
      .set('Authorization', auth(token))
      .send({ action: 'unknown_thing', payload: {} })
      .expect(422);
  });

  it('enforces resend cooldown and hides foreign challenges', async () => {
    const email = uniqueEmail('stepup-resend');
    const token = await signIn(email);
    const stranger = await signIn(uniqueEmail('stepup-stranger'));

    const created = await request(server())
      .post('/api/v1/step-up')
      .set('Authorization', auth(token))
      .send({
        action: 'change_email',
        payload: { new_email: uniqueEmail('stepup-target') },
      })
      .expect(200);

    const challenge = (
      created.body as { data: { id: string; next_factor_id: string } }
    ).data;

    const throttled = await request(server())
      .post(`/api/v1/step-up/${challenge.id}/resend`)
      .set('Authorization', auth(token))
      .send({ factor_id: challenge.next_factor_id })
      .expect(429);
    expect(throttled.body).toMatchObject({ code: 'otp_throttled' });

    const foreign = await request(server())
      .post(`/api/v1/step-up/${challenge.id}/verify`)
      .set('Authorization', auth(stranger))
      .send({ factor_id: challenge.next_factor_id, code: '123456' })
      .expect(410);
    expect(foreign.body).toMatchObject({ code: 'step_up_expired' });
  });

  it('blocks account deletion for organisation owners', async () => {
    const email = uniqueEmail('stepup-owner');
    const token = await signIn(email);
    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();

    await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(token))
      .send({
        name: 'Sticky Org',
        slug: `sticky-${Date.now().toString(36)}`,
        category_id: category.id,
      })
      .expect(201);

    const denied = await request(server())
      .post('/api/v1/step-up')
      .set('Authorization', auth(token))
      .send({ action: 'delete_account', payload: {} })
      .expect(409);
    expect(denied.body).toMatchObject({ code: 'account_owns_organisations' });
  });

  it('deletes an account through the single-otp flow', async () => {
    const email = uniqueEmail('stepup-delete');
    const token = await signIn(email);

    const created = await request(server())
      .post('/api/v1/step-up')
      .set('Authorization', auth(token))
      .send({ action: 'delete_account', payload: {} })
      .expect(200);

    const challenge = (
      created.body as { data: { id: string; next_factor_id: string } }
    ).data;

    const code = lastCodeFor(email);

    const completed = await request(server())
      .post(`/api/v1/step-up/${challenge.id}/verify`)
      .set('Authorization', auth(token))
      .send({ factor_id: challenge.next_factor_id, code })
      .expect(200);

    expect(completed.body).toMatchObject({
      data: { completed: true, result: { deleted: true } },
    });

    await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(token))
      .expect(401);

    const gone = await ctx.prisma.user.findFirst({ where: { email } });
    expect(gone).toBeNull();
  });
});
