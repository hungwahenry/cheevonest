import { createHmac } from 'node:crypto';
import request from 'supertest';
import { Webhook } from 'svix';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { PaystackProvider } from '../src/modules/payments/providers/paystack.provider';
import {
  createTestApp,
  extractOtpCode,
  seedCatalog,
  seedInterests,
  seedPlatform,
  TestContext,
  uniqueEmail,
} from './create-test-app';

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const PAYSTACK_TEST_SECRET = 'sk_test_secret';
const RESEND_WEBHOOK_SECRET = 'whsec_dGVzdC1zZWNyZXQtZm9yLXN2aXg=';

describe('Broadcasts (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let buyerToken: string;
  let buyerEmail: string;
  let rsvperToken: string;
  let rsvperEmail: string;
  let orgId: string;
  let eventId: string;
  let ticketId: string;
  const initializedReferences: string[] = [];

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const broadcastsPath = () => `/api/v1/organizer/events/${eventId}/broadcasts`;

  const signIn = async (email: string): Promise<string> => {
    await ctx.prisma.otpCode.deleteMany({ where: { email } });
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const waitForStatus = async (
    broadcastId: string,
    statuses: string[],
    timeoutMs = 5000,
  ): Promise<string> => {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const row = await ctx.prisma.broadcast.findUniqueOrThrow({
        where: { id: broadcastId },
        select: { status: true },
      });

      if (statuses.includes(row.status)) {
        return row.status;
      }

      if (Date.now() > deadline) {
        throw new Error(`broadcast stuck in ${row.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  beforeAll(async () => {
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
    process.env.RESEND_WEBHOOK_SECRET = RESEND_WEBHOOK_SECRET;
    ctx = await createTestApp({
      overrides: (builder: TestingModuleBuilder) =>
        builder.overrideProvider(PaystackProvider).useValue({
          name: () => 'paystack',
          requiresHttpsCallback: () => true,
          initialize: (req: { reference: string }) => {
            initializedReferences.push(req.reference);

            return Promise.resolve({
              authorizationUrl: `https://checkout.test/${req.reference}`,
              providerReference: req.reference,
              providerResponse: {},
            });
          },
          verify: () => Promise.reject(new Error('not used')),
          verifyWebhookSignature: (
            rawBody: Buffer | string,
            signature?: string,
          ) =>
            signature ===
            createHmac('sha512', PAYSTACK_TEST_SECRET)
              .update(rawBody)
              .digest('hex'),
          parseWebhookEvent: (payload: Record<string, unknown>) => {
            if (payload.event !== 'charge.success') {
              return null;
            }

            const data = payload.data as Record<string, unknown>;

            return {
              reference: String(data.reference),
              providerReference: String(data.reference),
              status: 'successful',
              amountMinor: Number(data.amount),
              currency: data.currency,
              providerResponse: data,
            };
          },
          parseTransferWebhookEvent: () => null,
          createTransferRecipient: () => Promise.resolve('RCP_test'),
          transfer: () => Promise.reject(new Error('not used')),
        }),
    });

    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    const run = Date.now().toString(36);
    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();

    ownerToken = await signIn(uniqueEmail('bc-owner'));
    const org = await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'Broadcast Org',
        slug: `bc-org-${run}`,
        category_id: category.id,
      })
      .expect(201);
    orgId = (org.body as { data: { id: string } }).data.id;

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Broadcast Bash ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;

    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'Broadcasts under test.')
      .field('starts_at', '2027-12-20 20:00')
      .field('ends_at', '2027-12-21 02:00')
      .field('venue_name', 'Broadcast Dome')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'flyer.png',
        contentType: 'image/png',
      })
      .expect(200);

    const ticket = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/tickets`)
      .set('Authorization', auth(ownerToken))
      .send({ name: 'GA', gross_price: 100000, status: 'on_sale' })
      .expect(201);
    ticketId = (ticket.body as { data: { id: string } }).data.id;

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    buyerEmail = uniqueEmail('bc-buyer');
    buyerToken = await signIn(buyerEmail);
    const order = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/orders`)
      .set('Authorization', auth(buyerToken))
      .send({
        items: [{ ticket_id: ticketId, quantity: 1 }],
        callback_url: 'cheevo:///orders/return',
      })
      .expect(200);

    const reference = initializedReferences.at(-1)!;
    const raw = JSON.stringify({
      event: 'charge.success',
      data: {
        id: `evt_${reference}`,
        reference,
        amount: (order.body as { data: { order: { total_minor: number } } })
          .data.order.total_minor,
        currency: 'NGN',
        status: 'success',
      },
    });
    await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set(
        'x-paystack-signature',
        createHmac('sha512', PAYSTACK_TEST_SECRET).update(raw).digest('hex'),
      )
      .send(raw)
      .expect(200);

    rsvperEmail = uniqueEmail('bc-rsvper');
    rsvperToken = await signIn(rsvperEmail);
    await request(server())
      .post(`/api/v1/attendee/events/${eventId}/rsvp`)
      .set('Authorization', auth(rsvperToken))
      .expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('sends a test email to the requester only', async () => {
    const mailsBefore = ctx.mails.length;

    await request(server())
      .post(`${broadcastsPath()}/test`)
      .set('Authorization', auth(ownerToken))
      .send({
        audience: 'both',
        subject: 'Soundcheck',
        body_html: '<p>Hello <strong>fam</strong></p>',
      })
      .expect(200);

    const testMails = ctx.mails.slice(mailsBefore);
    expect(testMails).toHaveLength(1);
    expect(testMails[0].subject).toBe('[TEST] Soundcheck');
    expect(testMails[0].template).toBe('broadcast');
  });

  it('creates a broadcast, sanitizes html, and delivers to the audience', async () => {
    const mailsBefore = ctx.mails.length;

    const created = await request(server())
      .post(broadcastsPath())
      .set('Authorization', auth(ownerToken))
      .send({
        audience: 'both',
        subject: 'Doors open 8pm',
        body_html:
          '<p>See you <strong>there</strong>!</p><script>alert(1)</script>',
      })
      .expect(201);

    const broadcast = (
      created.body as {
        data: {
          id: string;
          status: string;
          recipients_count: number;
          body_html: string;
        };
      }
    ).data;

    expect(broadcast.status).toBe('queued');
    expect(broadcast.recipients_count).toBe(2);
    expect(broadcast.body_html).not.toContain('script');

    const status = await waitForStatus(broadcast.id, ['sent', 'failed']);
    expect(status).toBe('sent');

    const row = await ctx.prisma.broadcast.findUniqueOrThrow({
      where: { id: broadcast.id },
    });
    expect(row.sentCount).toBe(2);
    expect(row.failedCount).toBe(0);
    expect(row.sentAt).not.toBeNull();

    const delivered = ctx.mails
      .slice(mailsBefore)
      .filter((mail) => mail.template === 'broadcast');
    const recipients = delivered.map((mail) => mail.to).sort();
    expect(recipients).toEqual([buyerEmail, rsvperEmail].sort());

    const context = delivered[0].context as {
      unsubscribeUrl: string;
      bodyHtml: string;
    };
    expect(context.unsubscribeUrl).toContain('/unsubscribe/broadcasts/');
    expect(context.unsubscribeUrl).toContain('signature=');

    const ownerInbox = await ctx.prisma.notification.findFirst({
      where: { type: 'broadcast.finished' },
      orderBy: { createdAt: 'desc' },
    });
    expect(ownerInbox).not.toBeNull();
  });

  it('enforces cooldown and per-event limits', async () => {
    const second = await request(server())
      .post(broadcastsPath())
      .set('Authorization', auth(ownerToken))
      .send({
        audience: 'both',
        subject: 'Another one',
        body_html: '<p>Too soon</p>',
      })
      .expect(429);
    expect(second.body).toMatchObject({ code: 'broadcast_cooldown_active' });

    await ctx.prisma.broadcast.updateMany({
      where: { eventId },
      data: { createdAt: new Date(Date.now() - 13 * 3600_000) },
    });

    await ctx.prisma.systemConfig.update({
      where: { key: 'broadcasts.max_per_event' },
      data: { value: { v: 1 } },
    });

    const limited = await request(server())
      .post(broadcastsPath())
      .set('Authorization', auth(ownerToken))
      .send({
        audience: 'both',
        subject: 'Limit test',
        body_html: '<p>Should hit limit</p>',
      })
      .expect(422);
    expect(limited.body).toMatchObject({ code: 'broadcast_limit_reached' });

    await ctx.prisma.systemConfig.update({
      where: { key: 'broadcasts.max_per_event' },
      data: { value: { v: 3 } },
    });
  });

  it('unsubscribes via the signed link and suppresses future sends', async () => {
    const mail = [...ctx.mails]
      .reverse()
      .find((m) => m.template === 'broadcast' && m.to === rsvperEmail)!;
    const unsubscribeUrl = (mail.context as { unsubscribeUrl: string })
      .unsubscribeUrl;
    const path = unsubscribeUrl.replace(/^https?:\/\/[^/]+/, '');

    const tampered = await request(server()).get(
      path.replace(/signature=\w+/, 'signature=deadbeef'),
    );
    expect(tampered.status).toBe(403);
    expect(tampered.text).toContain('Invalid');

    const page = await request(server()).get(path).expect(200);
    expect(page.text).toContain("You're unsubscribed");

    const suppression = await ctx.prisma.broadcastSuppression.findFirst({
      where: { email: rsvperEmail.toLowerCase(), organisationId: orgId },
    });
    expect(suppression).toMatchObject({ reason: 'unsubscribed' });

    const created = await request(server())
      .post(broadcastsPath())
      .set('Authorization', auth(ownerToken))
      .send({
        audience: 'both',
        subject: 'After unsubscribe',
        body_html: '<p>Only buyers now</p>',
      })
      .expect(201);

    expect(created.body).toMatchObject({ data: { recipients_count: 1 } });

    const broadcastId = (created.body as { data: { id: string } }).data.id;
    await waitForStatus(broadcastId, ['sent']);

    await ctx.prisma.broadcast.updateMany({
      where: { eventId },
      data: { createdAt: new Date(Date.now() - 13 * 3600_000) },
    });
  });

  it('records resend bounces as global suppressions via svix webhook', async () => {
    const payload = JSON.stringify({
      type: 'email.bounced',
      data: { to: [buyerEmail] },
    });
    const msgId = `msg_${Date.now()}`;
    const webhook = new Webhook(RESEND_WEBHOOK_SECRET);
    const signature = webhook.sign(msgId, new Date(), payload);

    await request(server())
      .post('/api/v1/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set('svix-id', msgId)
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', signature)
      .send(payload)
      .expect(200);

    const suppression = await ctx.prisma.broadcastSuppression.findFirst({
      where: { email: buyerEmail.toLowerCase(), organisationId: null },
    });
    expect(suppression).toMatchObject({ reason: 'bounced' });

    await request(server())
      .post('/api/v1/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_bogus')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,bogus')
      .send(payload)
      .expect(401);

    const empty = await request(server())
      .post(broadcastsPath())
      .set('Authorization', auth(ownerToken))
      .send({
        audience: 'both',
        subject: 'Everyone suppressed',
        body_html: '<p>Nobody left</p>',
      })
      .expect(422);
    expect(empty.body).toMatchObject({ code: 'broadcast_audience_empty' });
  });
});
