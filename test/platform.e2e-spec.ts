import { ulid } from 'ulid';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, seedPlatform, TestContext } from './create-test-app';

describe('Platform (e2e)', () => {
  let ctx: TestContext;

  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedPlatform(ctx.prisma);
  });

  afterAll(async () => {
    await seedPlatform(ctx.prisma);
    await ctx.app.close();
  });

  it('serves public configs with an ETag and honours If-None-Match', async () => {
    const first = await request(server()).get('/api/v1/config').expect(200);

    const body = first.body as {
      status: string;
      data: Record<string, unknown>;
    };
    expect(body.status).toBe('success');
    expect(body.data['orders.fee_flat_minor']).toBe(10000);
    expect(body.data['orders.fee_percentage_bps']).toBe(300);
    expect(body.data['auth.token_ttl_minutes']).toBeUndefined();

    const etag = first.headers.etag;
    expect(etag).toMatch(/^W\/"config-/);

    const cached = await request(server())
      .get('/api/v1/config')
      .set('If-None-Match', etag)
      .expect(304);

    expect(cached.headers.etag).toBe(etag);
    expect(cached.text ?? '').toBe('');
  });

  it('reflects config updates with a fresh ETag', async () => {
    const before = await request(server()).get('/api/v1/config').expect(200);

    await ctx.prisma.systemConfig.update({
      where: { key: 'orders.hold_ttl_minutes' },
      data: { value: { v: 25 } },
    });

    const after = await request(server()).get('/api/v1/config').expect(200);

    expect(
      (after.body as { data: Record<string, unknown> }).data[
        'orders.hold_ttl_minutes'
      ],
    ).toBe(25);
    expect(after.headers.etag).not.toBe(before.headers.etag);
  });

  it('serves public flags and hides private ones', async () => {
    const response = await request(server()).get('/api/v1/flags').expect(200);

    const body = response.body as { data: Record<string, boolean> };
    expect(body.data['comments.enabled']).toBe(true);
    expect(body.data['payouts.enabled']).toBe(true);
    expect(body.data['admin.system_announcements']).toBeUndefined();

    const etag = response.headers.etag;
    expect(etag).toMatch(/^W\/"flags-/);

    await request(server())
      .get('/api/v1/flags')
      .set('If-None-Match', etag)
      .expect(304);
  });

  it('turns a flag off at rollout 0 and on at 100', async () => {
    await ctx.prisma.featureFlag.update({
      where: { key: 'rsvp.enabled' },
      data: { rolloutPct: 0 },
    });

    const off = await request(server()).get('/api/v1/flags').expect(200);
    expect(
      (off.body as { data: Record<string, boolean> }).data['rsvp.enabled'],
    ).toBe(false);

    await ctx.prisma.featureFlag.update({
      where: { key: 'rsvp.enabled' },
      data: { rolloutPct: 100 },
    });

    const on = await request(server()).get('/api/v1/flags').expect(200);
    expect(
      (on.body as { data: Record<string, boolean> }).data['rsvp.enabled'],
    ).toBe(true);
  });

  it('overrides env-configured OTP behaviour from system configs', async () => {
    await ctx.prisma.systemConfig.update({
      where: { key: 'auth.otp_resend_cooldown_seconds' },
      data: { value: { v: 0 } },
    });

    const email = `cooldown-off-${Date.now()}@example.com`;

    await request(server())
      .post('/api/v1/auth/send-otp')
      .send({ email })
      .expect(200);

    await request(server())
      .post('/api/v1/auth/send-otp')
      .send({ email })
      .expect(200);

    await ctx.prisma.systemConfig.update({
      where: { key: 'auth.otp_resend_cooldown_seconds' },
      data: { value: { v: 60 } },
    });
  });

  it('serves welcome content with defaults', async () => {
    const response = await request(server()).get('/api/v1/welcome').expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        background_url: null,
        headline: 'Find your people, find your night.',
      },
    });
  });

  it('lists and shows only published pages', async () => {
    await ctx.prisma.page.deleteMany();
    await ctx.prisma.page.createMany({
      data: [
        {
          id: ulid(),
          slug: 'terms',
          title: 'Terms of Service',
          bodyHtml: '<p>Terms body</p>',
          metaDescription: 'The terms',
          isPublished: true,
          publishedAt: new Date(),
        },
        {
          id: ulid(),
          slug: 'draft-page',
          title: 'Draft',
          bodyHtml: '<p>Hidden</p>',
          isPublished: false,
        },
      ],
    });

    const list = await request(server()).get('/api/v1/pages').expect(200);
    const items = (list.body as { data: Array<{ slug: string }> }).data;
    expect(items).toHaveLength(1);
    expect(items[0].slug).toBe('terms');

    const show = await request(server()).get('/api/v1/pages/terms').expect(200);
    expect(show.body).toMatchObject({
      data: {
        slug: 'terms',
        title: 'Terms of Service',
        body_html: '<p>Terms body</p>',
        meta_description: 'The terms',
      },
    });

    await request(server()).get('/api/v1/pages/draft-page').expect(404);
  });

  it('serves app-link files at the root without the API prefix or envelope', async () => {
    const apple = await request(server())
      .get('/.well-known/apple-app-site-association')
      .expect(200);

    expect(apple.body).toEqual({ applinks: { apps: [], details: [] } });

    const android = await request(server())
      .get('/.well-known/assetlinks.json')
      .expect(200);

    expect(android.body).toEqual([]);
  });
});
