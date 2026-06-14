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

describe('Admin platform ops (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let attendee: string;

  const server = () => ctx.app.getHttpServer();
  const a = (t: string) => `Bearer ${t}`;

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
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rejects non-admins from the ops surface', async () => {
    await request(server())
      .get('/api/v1/admin/ops/health')
      .set('Authorization', a(attendee))
      .expect(403);
  });

  it('reports system health', async () => {
    const res = await request(server())
      .get('/api/v1/admin/ops/health')
      .set('Authorization', a(admin))
      .expect(200);

    const body = (
      res.body as {
        data: {
          database: { ok: boolean };
          search: Record<string, number>;
          push: { tokens: number };
        };
      }
    ).data;
    expect(body.database.ok).toBe(true);
    expect(body.search).toHaveProperty('total');
    expect(body.push).toHaveProperty('tokens');
  });

  it('lists and runs maintenance commands', async () => {
    const list = await request(server())
      .get('/api/v1/admin/ops/commands')
      .set('Authorization', a(admin))
      .expect(200);
    const commands = (
      list.body as { data: Array<{ command: string }> }
    ).data.map((c) => c.command);
    expect(commands).toContain('search:reindex');

    const run = await request(server())
      .post('/api/v1/admin/ops/commands/search:reindex/run')
      .set('Authorization', a(admin))
      .expect(200);
    expect((run.body as { data: { command: string } }).data.command).toBe(
      'search:reindex',
    );

    const audited = await ctx.prisma.adminAction.findFirst({
      where: { action: 'ops.run_command', targetId: 'search:reindex' },
    });
    expect(audited).not.toBeNull();
  });

  it('rejects an unknown maintenance command', async () => {
    await request(server())
      .post('/api/v1/admin/ops/commands/rm:rf/run')
      .set('Authorization', a(admin))
      .expect(422);
  });

  it('pings', async () => {
    const res = await request(server())
      .get('/api/v1/admin/ping')
      .set('Authorization', a(admin))
      .expect(200);
    expect((res.body as { data: { ok: boolean } }).data.ok).toBe(true);
  });
});
