import { createHmac } from 'node:crypto';
import request from 'supertest';
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
const SECRET = 'sk_test_secret';

describe('Admin commerce & content (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let owner: string;
  let buyer: string;
  let buyerId: string;
  let strangerId: string;
  let eventId: string;
  let ticketId: string;
  const refs: string[] = [];

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

  const payOrder = async (token: string, quantity: number): Promise<string> => {
    const order = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/orders`)
      .set('Authorization', a(token))
      .send({
        items: [{ ticket_id: ticketId, quantity }],
        callback_url: 'cheevo:///orders/return',
      })
      .expect(200);
    const orderId = (order.body as { data: { order: { id: string } } }).data
      .order.id;
    const reference = refs.at(-1)!;
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
        createHmac('sha512', SECRET).update(raw).digest('hex'),
      )
      .send(raw)
      .expect(200);
    return orderId;
  };

  beforeAll(async () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    ctx = await createTestApp({
      overrides: (b: TestingModuleBuilder) =>
        b.overrideProvider(PaystackProvider).useValue({
          name: () => 'paystack',
          requiresHttpsCallback: () => true,
          initialize: (req: { reference: string }) => {
            refs.push(req.reference);
            return Promise.resolve({
              authorizationUrl: `https://c.test/${req.reference}`,
              providerReference: req.reference,
              providerResponse: {},
            });
          },
          verify: (lookup: string) =>
            Promise.resolve({
              reference: lookup,
              providerReference: lookup,
              status: 'successful',
              amountMinor: Number(process.env.TEST_VERIFY_AMOUNT ?? 0),
              currency: 'NGN',
              providerResponse: {},
            }),
          verifyWebhookSignature: (raw: Buffer | string, sig?: string) =>
            sig === createHmac('sha512', SECRET).update(raw).digest('hex'),
          parseWebhookEvent: (p: Record<string, unknown>) => {
            if (p.event !== 'charge.success') return null;
            const d = p.data as Record<string, unknown>;
            return {
              reference: String(d.reference),
              providerReference: String(d.reference),
              status: 'successful',
              amountMinor: Number(d.amount),
              currency: d.currency,
              providerResponse: d,
            };
          },
          parseTransferWebhookEvent: () => null,
          createTransferRecipient: () => Promise.resolve('RCP'),
          transfer: () => Promise.reject(new Error('x')),
        }),
    });
    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    const run = Date.now().toString(36);
    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();
    admin = await signIn(uniqueEmail('adm'));
    await ctx.prisma.user.update({
      where: { id: await meId(admin) },
      data: { role: 'admin' },
    });
    owner = await signIn(uniqueEmail('own'));
    await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', a(owner))
      .send({ name: 'C Org', slug: `c-org-${run}`, category_id: category.id })
      .expect(201);
    const ev = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', a(owner))
      .send({ title: `C Night ${run}` })
      .expect(201);
    eventId = (ev.body as { data: { id: string } }).data.id;
    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', a(owner))
      .field('description', 'c.')
      .field('starts_at', '2028-03-01 20:00')
      .field('ends_at', '2028-03-02 02:00')
      .field('venue_name', 'H')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'f.png',
        contentType: 'image/png',
      })
      .expect(200);
    const t = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/tickets`)
      .set('Authorization', a(owner))
      .send({ name: 'GA', gross_price: 500000, status: 'on_sale' })
      .expect(201);
    ticketId = (t.body as { data: { id: string } }).data.id;
    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Authorization', a(owner))
      .expect(200);

    buyer = await signIn(uniqueEmail('buy'));
    buyerId = await meId(buyer);
    const stranger = await signIn(uniqueEmail('str'));
    strangerId = await meId(stranger);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('refunds an order and fixes the sold counters (Laravel drift fix)', async () => {
    const orderId = await payOrder(buyer, 2);
    const eventBefore = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(eventBefore.ticketsSold).toBe(2);

    const res = await request(server())
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set('Authorization', a(admin))
      .send({ amount_minor: 1040000, reason: 'duplicate charge' })
      .expect(200);
    expect(res.body).toMatchObject({
      message: 'Order refunded.',
      data: { status: 'refunded' },
    });

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { issuedTickets: true, payment: true },
    });
    expect(order.payment?.status).toBe('refunded');
    expect(order.issuedTickets.every((t) => t.status === 'revoked')).toBe(true);

    const eventAfter = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(eventAfter.ticketsSold).toBe(0);
    expect(Number(eventAfter.revenueMinor)).toBe(
      Number(eventBefore.revenueMinor) - 1000000,
    );
    const ga = await ctx.prisma.eventTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(ga.soldCount).toBe(0);

    const partial = await request(server())
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set('Authorization', a(admin))
      .send({ amount_minor: 500, reason: 'x' })
      .expect(409);
    expect(partial.body).toMatchObject({ code: 'order_not_refundable' });
  });

  it('marks a pending order paid and issues tickets', async () => {
    const created = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/orders`)
      .set('Authorization', a(buyer))
      .send({
        items: [{ ticket_id: ticketId, quantity: 1 }],
        callback_url: 'cheevo:///orders/return',
      })
      .expect(200);
    const orderId = (created.body as { data: { order: { id: string } } }).data
      .order.id;

    await request(server())
      .post(`/api/v1/admin/orders/${orderId}/mark-paid`)
      .set('Authorization', a(admin))
      .expect(200);

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { issuedTickets: true, payment: true },
    });
    expect(order.status).toBe('paid');
    expect(order.issuedTickets).toHaveLength(1);
    expect(order.payment?.status).toBe('successful');
  });

  it('manages issued tickets: revoke, reissue, transfer with guards', async () => {
    const orderId = await payOrder(buyer, 1);
    const ticket = await ctx.prisma.issuedTicket.findFirstOrThrow({
      where: { orderId },
    });

    const revoked = await request(server())
      .post(`/api/v1/admin/issued-tickets/${ticket.id}/revoke`)
      .set('Authorization', a(admin))
      .expect(200);
    expect(revoked.body).toMatchObject({ data: { status: 'revoked' } });

    const reissued = await request(server())
      .post(`/api/v1/admin/issued-tickets/${ticket.id}/reissue`)
      .set('Authorization', a(admin))
      .expect(200);
    const newCode = (reissued.body as { data: { code: string } }).data.code;
    expect(newCode).not.toBe(ticket.code);

    await request(server())
      .post(`/api/v1/admin/issued-tickets/${ticket.id}/transfer`)
      .set('Authorization', a(admin))
      .send({ to_user_id: strangerId, reason: 'gift' })
      .expect(200);
    const moved = await ctx.prisma.issuedTicket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(moved.holderUserId).toBe(strangerId);

    // scan it, then reissue must fail (only revoked are reissuable)
    await ctx.prisma.issuedTicket.update({
      where: { id: ticket.id },
      data: { status: 'scanned', scannedAt: new Date() },
    });
    const noReissue = await request(server())
      .post(`/api/v1/admin/issued-tickets/${ticket.id}/reissue`)
      .set('Authorization', a(admin))
      .expect(409);
    expect(noReissue.body).toMatchObject({ code: 'ticket_not_reissuable' });
    const noRevoke = await request(server())
      .post(`/api/v1/admin/issued-tickets/${ticket.id}/revoke`)
      .set('Authorization', a(admin))
      .expect(409);
    expect(noRevoke.body).toMatchObject({ code: 'ticket_already_scanned' });
  });

  it('runs the report workflow and deletes the target comment', async () => {
    const comment = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/comments`)
      .set('Authorization', a(buyer))
      .send({ body: 'spam spam spam' })
      .expect(200);
    const commentId = (comment.body as { data: { id: string } }).data.id;

    const reason = await ctx.prisma.reportReason.findFirstOrThrow({
      where: { slug: 'spam' },
    });
    await request(server())
      .post('/api/v1/reports')
      .set('Authorization', a(owner))
      .send({
        target_type: 'event_comment',
        target_id: commentId,
        report_reason_id: reason.id,
      })
      .expect(201);
    const reportRow = await ctx.prisma.report.findFirstOrThrow({
      where: { targetType: 'event_comment', targetId: commentId },
    });

    const show = await request(server())
      .get(`/api/v1/admin/reports/${reportRow.id}`)
      .set('Authorization', a(admin))
      .expect(200);
    expect(
      (show.body as { data: { target: Record<string, unknown> } }).data.target,
    ).toMatchObject({
      type: 'comment',
      id: commentId,
    });

    await request(server())
      .post(`/api/v1/admin/reports/${reportRow.id}/start-review`)
      .set('Authorization', a(admin))
      .expect(200);

    await request(server())
      .post(`/api/v1/admin/reports/${reportRow.id}/action`)
      .set('Authorization', a(admin))
      .send({ action: 'delete_target', resolution_note: 'removed spam' })
      .expect(200);

    expect(
      await ctx.prisma.eventComment.findUnique({ where: { id: commentId } }),
    ).toBeNull();
    const resolved = await ctx.prisma.report.findUniqueOrThrow({
      where: { id: reportRow.id },
    });
    expect(resolved.status).toBe('actioned');
  });

  it('deletes a comment and dismisses flags directly', async () => {
    const c1 = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/comments`)
      .set('Authorization', a(buyer))
      .send({ body: 'comment to flag' })
      .expect(200);
    const flaggedId = (c1.body as { data: { id: string } }).data.id;
    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/comments/${flaggedId}/flag`)
      .set('Authorization', a(owner))
      .expect(200);

    const dismissed = await request(server())
      .post(`/api/v1/admin/comments/${flaggedId}/dismiss-flags`)
      .set('Authorization', a(admin))
      .expect(200);
    expect(dismissed.body).toMatchObject({ data: { cleared: 1 } });
    expect(
      (
        await ctx.prisma.eventComment.findUniqueOrThrow({
          where: { id: flaggedId },
        })
      ).flagsCount,
    ).toBe(0);

    await request(server())
      .delete(`/api/v1/admin/comments/${flaggedId}`)
      .set('Authorization', a(admin))
      .send({ reason: 'cleanup' })
      .expect(200);
    expect(
      await ctx.prisma.eventComment.findUnique({ where: { id: flaggedId } }),
    ).toBeNull();

    const audit = await ctx.prisma.adminAction.findFirst({
      where: { action: 'comments.delete', targetId: flaggedId },
    });
    expect((audit?.payload as { body?: string } | null)?.body).toBe(
      'comment to flag',
    );
  });

  it('resyncs and force-marks payments', async () => {
    const created = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/orders`)
      .set('Authorization', a(buyer))
      .send({
        items: [{ ticket_id: ticketId, quantity: 1 }],
        callback_url: 'cheevo:///orders/return',
      })
      .expect(200);
    const payment = await ctx.prisma.payment.findFirstOrThrow({
      where: {
        purposableId: (created.body as { data: { order: { id: string } } }).data
          .order.id,
      },
    });

    const marked = await request(server())
      .post(`/api/v1/admin/payments/${payment.id}/mark-success`)
      .set('Authorization', a(admin))
      .expect(200);
    expect(marked.body).toMatchObject({ data: { status: 'successful' } });

    const refused = await request(server())
      .post(`/api/v1/admin/payments/${payment.id}/mark-success`)
      .set('Authorization', a(admin))
      .expect(200);
    expect(refused.body).toMatchObject({ data: { status: 'successful' } });
  });

  it('lists with rich refs and filters', async () => {
    const orders = await request(server())
      .get(`/api/v1/admin/orders?event_id=${eventId}`)
      .set('Authorization', a(admin))
      .expect(200);
    const item = (
      orders.body as {
        data: {
          items: Array<{
            buyer: Record<string, unknown>;
            event: Record<string, unknown>;
          }>;
        };
      }
    ).data.items[0];
    expect(item.buyer).toMatchObject({ type: 'user', id: buyerId });
    expect(item.event).toMatchObject({ type: 'event', id: eventId });

    const tickets = await request(server())
      .get('/api/v1/admin/issued-tickets?status=valid')
      .set('Authorization', a(admin))
      .expect(200);
    expect(
      (
        tickets.body as {
          data: { items: Array<{ holder: Record<string, unknown> }> };
        }
      ).data.items[0].holder,
    ).toMatchObject({
      type: 'user',
    });
  });

  it('builds revenue leaderboards from paid orders', async () => {
    await payOrder(buyer, 1);

    const res = await request(server())
      .get('/api/v1/admin/analytics/leaderboards?days=365&limit=10')
      .set('Authorization', a(admin))
      .expect(200);

    const data = (
      res.body as {
        data: {
          currency: string;
          top_events: Array<{
            event: { type: string; id: string };
            gmv_minor: number;
            tickets: number;
          }>;
          top_organisers: Array<{ organisation: { type: string } }>;
          by_category: Array<{ category: { name: string }; gmv_minor: number }>;
        };
      }
    ).data;

    expect(data.currency).toBe('NGN');
    expect(data.top_events.length).toBeGreaterThan(0);
    expect(data.top_events[0].event).toMatchObject({ type: 'event' });
    expect(typeof data.top_events[0].gmv_minor).toBe('number');
    expect(data.top_organisers[0].organisation).toMatchObject({
      type: 'organisation',
    });
    expect(data.by_category.length).toBeGreaterThan(0);
  });
});
