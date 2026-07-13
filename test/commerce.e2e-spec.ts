import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { OrdersService } from '../src/modules/orders/services/orders.service';
import { PaystackProvider } from '../src/modules/payments/providers/paystack/paystack.provider';
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

describe('Commerce (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let buyerToken: string;
  let eventId: string;
  let gaTicketId: string;
  let vipTicketId: string;
  const initializedReferences: string[] = [];

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const ordersPath = () => `/api/v1/attendee/events/${eventId}/orders`;

  const signIn = async (email: string): Promise<string> => {
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const createOrder = (
    token: string,
    items: Array<{ ticket_id: string; quantity: number }>,
  ): request.Test =>
    request(server())
      .post(ordersPath())
      .set('Authorization', auth(token))
      .send({ items, callback_url: 'cheevo:///orders/return' });

  const paystackWebhook = (payload: Record<string, unknown>): request.Test => {
    const raw = JSON.stringify(payload);
    const signature = createHmac('sha512', PAYSTACK_TEST_SECRET)
      .update(raw)
      .digest('hex');

    return request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature)
      .send(raw);
  };

  const chargeSuccessPayload = (
    reference: string,
    amountMinor: number,
    externalId: string,
  ) => ({
    event: 'charge.success',
    data: {
      id: externalId,
      reference,
      amount: amountMinor,
      currency: 'NGN',
      status: 'success',
    },
  });

  beforeAll(async () => {
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
    ctx = await createTestApp({
      overrides: (builder: TestingModuleBuilder) =>
        builder.overrideProvider(PaystackProvider).useValue({
          name: () => 'paystack',
          initialize: (req: { reference: string }) => {
            initializedReferences.push(req.reference);

            return Promise.resolve({
              authorizationUrl: `https://checkout.test/${req.reference}`,
              providerReference: req.reference,
              providerResponse: { reference: req.reference },
            });
          },
          verify: (lookupKey: string) =>
            Promise.resolve({
              reference: lookupKey,
              providerReference: lookupKey,
              status: 'successful',
              amountMinor: Number(process.env.TEST_VERIFY_AMOUNT ?? 0),
              currency: 'NGN',
              providerResponse: {},
            }),
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
        }),
    });

    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    const run = Date.now().toString(36);
    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();

    ownerToken = await signIn(uniqueEmail('shop-owner'));
    await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'Shop Org',
        slug: `shop-org-${run}`,
        category_id: category.id,
      })
      .expect(201);

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Ticketed Night ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;

    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'Commerce under test.')
      .field('starts_at', '2027-11-01 20:00')
      .field('ends_at', '2027-11-02 02:00')
      .field('venue_name', 'Commerce Hall')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'flyer.png',
        contentType: 'image/png',
      })
      .expect(200);

    const ga = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/tickets`)
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'GA',
        gross_price: 500000,
        quantity: 10,
        max_per_order: 4,
        status: 'on_sale',
      })
      .expect(201);
    gaTicketId = (ga.body as { data: { id: string } }).data.id;

    const vip = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/tickets`)
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'VIP',
        gross_price: 2000000,
        quantity: 2,
        status: 'on_sale',
      })
      .expect(201);
    vipTicketId = (vip.body as { data: { id: string } }).data.id;

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    buyerToken = await signIn(uniqueEmail('buyer'));
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('quotes an order with hybrid fees', async () => {
    const response = await request(server())
      .post(`${ordersPath()}/quote`)
      .set('Authorization', auth(buyerToken))
      .send({ items: [{ ticket_id: gaTicketId, quantity: 2 }] })
      .expect(200);

    expect(response.body).toMatchObject({
      data: {
        subtotal_minor: 1000000,
        fees_minor: 40000,
        total_minor: 1040000,
        currency: 'NGN',
        items: [
          {
            ticket_id: gaTicketId,
            ticket_name: 'GA',
            quantity: 2,
            unit_price_minor: 500000,
            subtotal_minor: 1000000,
          },
        ],
      },
    });
  });

  it('creates a pending order with holds and a checkout url', async () => {
    const response = await createOrder(buyerToken, [
      { ticket_id: gaTicketId, quantity: 2 },
    ]).expect(200);

    const body = response.body as {
      data: {
        order: { id: string; status: string; total_minor: number };
        authorization_url: string;
      };
    };

    expect(body.data.order.status).toBe('pending');
    expect(body.data.order.total_minor).toBe(1040000);
    expect(body.data.authorization_url).toContain('https://checkout.test/');

    const holds = await ctx.prisma.ticketHold.findMany({
      where: { orderId: body.data.order.id },
    });
    expect(holds).toHaveLength(1);
    expect(holds[0].quantity).toBe(2);

    const payment = await ctx.prisma.payment.findFirstOrThrow({
      where: { purposableId: body.data.order.id },
    });
    expect(payment.status).toBe('pending');
    expect(Number(payment.amountMinor)).toBe(1040000);
  });

  it('enforces availability: holds count against stock', async () => {
    const sold = await createOrder(buyerToken, [
      { ticket_id: vipTicketId, quantity: 2 },
    ]).expect(200);

    const second = await createOrder(buyerToken, [
      { ticket_id: vipTicketId, quantity: 1 },
    ]).expect(422);

    expect(second.body).toMatchObject({ code: 'ticket_sold_out' });

    await request(server())
      .delete(
        `/api/v1/attendee/orders/${(sold.body as { data: { order: { id: string } } }).data.order.id}`,
      )
      .set('Authorization', auth(buyerToken))
      .expect(200);

    const after = await createOrder(buyerToken, [
      { ticket_id: vipTicketId, quantity: 1 },
    ]).expect(200);

    await request(server())
      .delete(
        `/api/v1/attendee/orders/${(after.body as { data: { order: { id: string } } }).data.order.id}`,
      )
      .set('Authorization', auth(buyerToken))
      .expect(200);
  });

  it('enforces max-per-order and unknown tickets', async () => {
    const tooMany = await createOrder(buyerToken, [
      { ticket_id: gaTicketId, quantity: 5 },
    ]).expect(422);
    expect(tooMany.body).toMatchObject({
      code: 'ticket_max_per_order_exceeded',
    });

    await createOrder(buyerToken, [
      { ticket_id: '01JXXXXXXXXXXXXXXXXXXXXXXX', quantity: 1 },
    ]).expect(404);
  });

  it('fulfills an order through a signed paystack webhook exactly once', async () => {
    const created = await createOrder(buyerToken, [
      { ticket_id: gaTicketId, quantity: 2 },
    ]).expect(200);
    const orderId = (created.body as { data: { order: { id: string } } }).data
      .order.id;

    const reference = initializedReferences.at(-1)!;
    const eventBefore = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });

    await paystackWebhook(
      chargeSuccessPayload(reference, 1040000, `evt_${reference}`),
    ).expect(200);

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { issuedTickets: true, holds: true },
    });

    expect(order.status).toBe('paid');
    expect(order.paidAt).not.toBeNull();
    expect(order.issuedTickets).toHaveLength(2);
    expect(order.holds).toHaveLength(0);

    const eventAfter = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(eventAfter.ticketsSold - eventBefore.ticketsSold).toBe(2);
    expect(
      Number(eventAfter.revenueMinor) - Number(eventBefore.revenueMinor),
    ).toBe(1000000);
    expect(eventAfter.firstSaleNotifiedAt).not.toBeNull();

    const ga = await ctx.prisma.eventTicket.findUniqueOrThrow({
      where: { id: gaTicketId },
    });
    expect(ga.soldCount).toBe(2);

    await paystackWebhook(
      chargeSuccessPayload(reference, 1040000, `evt_${reference}`),
    ).expect(200);

    const replayed = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { issuedTickets: true },
    });
    expect(replayed.issuedTickets).toHaveLength(2);
  });

  it('rejects webhooks with bad signatures and parks amount mismatches', async () => {
    await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'bogus')
      .send(JSON.stringify({ event: 'charge.success', data: {} }))
      .expect(401);

    const created = await createOrder(buyerToken, [
      { ticket_id: gaTicketId, quantity: 1 },
    ]).expect(200);
    const orderId = (created.body as { data: { order: { id: string } } }).data
      .order.id;
    const reference = initializedReferences.at(-1)!;

    await paystackWebhook(
      chargeSuccessPayload(reference, 1, `evt_${reference}`),
    ).expect(200);

    const payment = await ctx.prisma.payment.findFirstOrThrow({
      where: { reference },
    });
    expect(payment.status).toBe('failed');

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe('pending');

    await request(server())
      .delete(`/api/v1/attendee/orders/${orderId}`)
      .set('Authorization', auth(buyerToken))
      .expect(200);
  });

  it('verifies an order by pulling from the provider', async () => {
    const created = await createOrder(buyerToken, [
      { ticket_id: gaTicketId, quantity: 1 },
    ]).expect(200);
    const orderId = (created.body as { data: { order: { id: string } } }).data
      .order.id;

    process.env.TEST_VERIFY_AMOUNT = '525000';

    const verified = await request(server())
      .post(`/api/v1/attendee/orders/${orderId}/verify`)
      .set('Authorization', auth(buyerToken))
      .send({})
      .expect(200);

    expect(verified.body).toMatchObject({
      data: { id: orderId, status: 'paid' },
    });
    expect(
      (verified.body as { data: { issued_tickets: unknown[] } }).data
        .issued_tickets,
    ).toHaveLength(1);
  });

  it('lists and shows my orders and tickets, hiding others', async () => {
    const orders = await request(server())
      .get('/api/v1/attendee/orders')
      .set('Authorization', auth(buyerToken))
      .expect(200);

    const orderItems = (
      orders.body as { data: { items: Array<{ id: string }> } }
    ).data.items;
    expect(orderItems.length).toBeGreaterThan(0);

    await request(server())
      .get(`/api/v1/attendee/orders/${orderItems[0].id}`)
      .set('Authorization', auth(ownerToken))
      .expect(404);

    const tickets = await request(server())
      .get('/api/v1/attendee/tickets?status=valid')
      .set('Authorization', auth(buyerToken))
      .expect(200);

    const ticketItems = (
      tickets.body as {
        data: { items: Array<{ id: string; event: { id: string } }> };
      }
    ).data.items;
    expect(ticketItems.length).toBeGreaterThan(0);
    expect(ticketItems[0].event.id).toBe(eventId);

    await request(server())
      .get(`/api/v1/attendee/tickets/${ticketItems[0].id}`)
      .set('Authorization', auth(ownerToken))
      .expect(404);
  });

  it('scans tickets with full guard rails and revoke frees the seat', async () => {
    const ticket = await ctx.prisma.issuedTicket.findFirstOrThrow({
      where: { eventId, status: 'valid' },
    });

    const scanned = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/issued-tickets/scan`)
      .set('Authorization', auth(ownerToken))
      .send({ code: ticket.code.toLowerCase() })
      .expect(200);

    expect(scanned.body).toMatchObject({
      message: 'Ticket scanned.',
      data: { id: ticket.id, status: 'scanned' },
    });
    expect(
      (scanned.body as { data: { holder: { email: string } } }).data.holder
        .email,
    ).toContain('buyer');

    const rescan = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/issued-tickets/scan`)
      .set('Authorization', auth(ownerToken))
      .send({ code: ticket.code })
      .expect(409);
    expect(rescan.body).toMatchObject({ code: 'ticket_already_scanned' });

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/issued-tickets/scan`)
      .set('Authorization', auth(ownerToken))
      .send({ code: 'NOPE123' })
      .expect(404);

    const before = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });

    await request(server())
      .post(
        `/api/v1/organizer/events/${eventId}/issued-tickets/${ticket.id}/revoke`,
      )
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const after = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(before.ticketsSold - after.ticketsSold).toBe(1);

    const revokedScan = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/issued-tickets/scan`)
      .set('Authorization', auth(ownerToken))
      .send({ code: ticket.code })
      .expect(410);
    expect(revokedScan.body).toMatchObject({ code: 'ticket_revoked' });
  });

  it('expires holds and cancels stale orders', async () => {
    const created = await createOrder(buyerToken, [
      { ticket_id: gaTicketId, quantity: 1 },
    ]).expect(200);
    const orderId = (created.body as { data: { order: { id: string } } }).data
      .order.id;

    await ctx.prisma.ticketHold.updateMany({
      where: { orderId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const orders = ctx.app.get(OrdersService);

    expect(await orders.expireHolds()).toBeGreaterThan(0);
    expect(await orders.cancelStalePending()).toBeGreaterThan(0);

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe('cancelled');
  });

  it('lists issued tickets for organizers with search', async () => {
    const response = await request(server())
      .get(`/api/v1/organizer/events/${eventId}/issued-tickets?q=buyer`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const items = (
      response.body as {
        data: { items: Array<{ holder: { email: string } }> };
      }
    ).data.items;

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].holder.email).toContain('buyer');
  });
});
