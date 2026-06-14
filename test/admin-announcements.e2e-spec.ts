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

describe('Admin announcements / broadcasts (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let attendee: string;
  let optedInId: string;
  let optedInEmail: string;
  let otherOptedInId: string;
  let notOptedInId: string;

  const server = () => ctx.app.getHttpServer();
  const a = (t: string) => `Bearer ${t}`;
  const base = '/api/v1/admin/announcements';

  const signIn = async (email: string): Promise<string> => {
    await ctx.prisma.otpCode.deleteMany({ where: { email } });
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const r = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });
    return (r.body as { data: { token: string } }).data.token;
  };
  const meId = async (t: string) =>
    (
      (
        await request(server())
          .get('/api/v1/auth/me')
          .set('Authorization', a(t))
          .expect(200)
      ).body as { data: { id: string } }
    ).data.id;
  const optIn = (userId: string) =>
    ctx.prisma.profile.update({
      where: { userId },
      data: { marketingOptIn: true },
    });
  const detail = (id: string, token = admin) =>
    request(server())
      .get(`${base}/${id}`)
      .set('Authorization', a(token))
      .expect(200);

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    admin = await signIn(uniqueEmail('adm'));
    await ctx.prisma.user.update({
      where: { id: await meId(admin) },
      data: { role: 'admin' },
    });

    attendee = await signIn(uniqueEmail('att'));

    optedInEmail = uniqueEmail('in');
    const optedIn = await signIn(optedInEmail);
    optedInId = await meId(optedIn);
    await optIn(optedInId);

    const otherOptedIn = await signIn(uniqueEmail('in2'));
    otherOptedInId = await meId(otherOptedIn);
    await optIn(otherOptedInId);

    const notOptedIn = await signIn(uniqueEmail('out'));
    notOptedInId = await meId(notOptedIn);
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const createBroadcast = async (body: Record<string, unknown>) =>
    (
      await request(server())
        .post(base)
        .set('Authorization', a(admin))
        .send(body)
        .expect(201)
    ).body as { data: { id: string } };

  it('rejects non-admins', async () => {
    await request(server())
      .get(base)
      .set('Authorization', a(attendee))
      .expect(403);
  });

  it('serves segment-builder options (roles + distinct cities)', async () => {
    await ctx.prisma.profile.update({
      where: { userId: optedInId },
      data: { city: 'Lagos', completedAt: new Date() },
    });

    const res = await request(server())
      .get(`${base}/segment-options`)
      .set('Authorization', a(admin))
      .expect(200);

    const data = (res.body as { data: { roles: string[]; cities: string[] } })
      .data;
    expect(data.roles).toContain('attendee');
    expect(data.cities).toContain('Lagos');
  });

  it('sends a system broadcast to an explicit set, ignoring consent', async () => {
    const created = await createBroadcast({
      kind: 'system',
      title: 'Scheduled maintenance',
      body: 'We will be briefly offline tonight.',
      channels: ['email', 'inapp'],
      audience: { user_ids: [optedInId, notOptedInId] },
    });

    const res = await request(server())
      .post(`${base}/${created.data.id}/send`)
      .set('Authorization', a(admin))
      .expect(200);

    const stats = (res.body as { data: { stats: { recipients: number } } }).data
      .stats;
    expect(stats.recipients).toBe(2);

    // A consent-less user still receives a system notice.
    const inbox = await ctx.prisma.notification.count({
      where: { userId: notOptedInId, type: 'admin.broadcast' },
    });
    expect(inbox).toBe(1);
  });

  it('previews a marketing audience filtered to opted-in users', async () => {
    const res = await request(server())
      .post(`${base}/preview`)
      .set('Authorization', a(admin))
      .send({
        kind: 'marketing',
        audience: { user_ids: [optedInId, otherOptedInId, notOptedInId] },
      })
      .expect(200);

    expect((res.body as { data: { recipients: number } }).data.recipients).toBe(
      2,
    );
  });

  it('sends a marketing broadcast only to consenting users, with unsubscribe + click tracking', async () => {
    const created = await createBroadcast({
      kind: 'marketing',
      title: 'Big weekend lineup',
      body: 'Check out https://cheevo.vip/events this weekend!',
      channels: ['email', 'inapp'],
      audience: { user_ids: [optedInId, otherOptedInId, notOptedInId] },
    });

    const before = ctx.mails.length;
    await request(server())
      .post(`${base}/${created.data.id}/send`)
      .set('Authorization', a(admin))
      .expect(200);

    const body = (await detail(created.data.id)).body as {
      data: { stats: { recipients: number }; links: { id: string }[] };
    };
    expect(body.data.stats.recipients).toBe(2);

    // The non-consenting user is skipped entirely for this marketing send.
    const skipped = await ctx.prisma.notification.count({
      where: {
        userId: notOptedInId,
        type: 'admin.broadcast',
        data: { path: ['broadcastId'], equals: created.data.id },
      },
    });
    expect(skipped).toBe(0);

    // Marketing email carries an unsubscribe link + one-click header.
    const mail = ctx.mails
      .slice(before)
      .find(
        (m) => m.to === optedInEmail && m.template === 'system-announcement',
      );
    expect(mail).toBeDefined();
    const context = mail!.context as { unsubscribeUrl: string };
    expect(context.unsubscribeUrl).toContain('/unsubscribe/marketing/');
    expect(mail!.headers?.['List-Unsubscribe']).toBeDefined();

    // The body URL was wrapped into a tracked redirect link.
    expect(body.data.links).toHaveLength(1);
    const linkId = body.data.links[0].id;

    const redirect = await request(server()).get(`/r/${linkId}`).expect(302);
    expect(redirect.headers.location).toBe('https://cheevo.vip/events');

    const link = await ctx.prisma.adminBroadcastLink.findUnique({
      where: { id: linkId },
    });
    expect(link?.clickCount).toBe(1);
  });

  it('honours the signed unsubscribe link', async () => {
    const created = await createBroadcast({
      kind: 'marketing',
      title: 'Another promo',
      body: 'Hello there.',
      channels: ['email'],
      audience: { user_ids: [otherOptedInId] },
    });
    const before = ctx.mails.length;
    await request(server())
      .post(`${base}/${created.data.id}/send`)
      .set('Authorization', a(admin))
      .expect(200);

    const mail = ctx.mails
      .slice(before)
      .find((m) => m.template === 'system-announcement')!;
    const unsubscribeUrl = (mail.context as { unsubscribeUrl: string })
      .unsubscribeUrl;
    const path = unsubscribeUrl.replace(/^https?:\/\/[^/]+/, '');

    const tampered = await request(server()).get(
      path.replace(/signature=\w+/, 'signature=deadbeef'),
    );
    expect(tampered.status).toBe(403);

    await request(server()).get(path).expect(200);

    const profile = await ctx.prisma.profile.findUnique({
      where: { userId: otherOptedInId },
    });
    expect(profile?.marketingOptIn).toBe(false);
  });

  it('refuses to send to an empty audience', async () => {
    const created = await createBroadcast({
      kind: 'marketing',
      title: 'Nobody home',
      body: 'x',
      channels: ['inapp'],
      audience: { cities: ['Atlantis'] },
    });

    await request(server())
      .post(`${base}/${created.data.id}/send`)
      .set('Authorization', a(admin))
      .expect(422);
  });

  it('guards editing and re-sending a finished broadcast', async () => {
    const created = await createBroadcast({
      kind: 'system',
      title: 'Done already',
      body: 'sent',
      channels: ['inapp'],
      audience: { user_ids: [optedInId] },
    });
    await request(server())
      .post(`${base}/${created.data.id}/send`)
      .set('Authorization', a(admin))
      .expect(200);

    await request(server())
      .patch(`${base}/${created.data.id}`)
      .set('Authorization', a(admin))
      .send({
        kind: 'system',
        title: 'Edit',
        body: 'x',
        channels: ['inapp'],
        audience: {},
      })
      .expect(409);

    await request(server())
      .post(`${base}/${created.data.id}/send`)
      .set('Authorization', a(admin))
      .expect(409);
  });

  it('schedules and cancels a broadcast', async () => {
    const created = await createBroadcast({
      kind: 'marketing',
      title: 'Later',
      body: 'soon',
      channels: ['inapp'],
      audience: {},
    });

    const scheduled = await request(server())
      .post(`${base}/${created.data.id}/schedule`)
      .set('Authorization', a(admin))
      .send({ scheduled_at: '2099-01-01T10:00:00.000Z' })
      .expect(200);
    expect((scheduled.body as { data: { status: string } }).data.status).toBe(
      'scheduled',
    );

    const cancelled = await request(server())
      .post(`${base}/${created.data.id}/cancel`)
      .set('Authorization', a(admin))
      .expect(200);
    expect((cancelled.body as { data: { status: string } }).data.status).toBe(
      'cancelled',
    );
  });
});
