import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestingModuleBuilder } from '@nestjs/testing';
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

describe('Ticket transfers (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let eventId: string;
  let gaTicketId: string;

  let senderToken: string;
  let senderId: string;
  let recipientToken: string;
  let recipientId: string;
  let otherBuyerToken: string;

  const initializedReferences: string[] = [];

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;

  const signIn = async (email: string): Promise<string> => {
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const userIdFor = async (email: string): Promise<string> =>
    (await ctx.prisma.user.findFirstOrThrow({ where: { email } })).id;

  /** Buys `qty` of a ticket and settles it through a signed webhook → issued tickets. */
  const buyAndPay = async (token: string, qty: number): Promise<void> => {
    const created = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/orders`)
      .set('Authorization', auth(token))
      .send({
        items: [{ ticket_id: gaTicketId, quantity: qty }],
        callback_url: 'cheevo:///orders/return',
      })
      .expect(200);

    const orderId = (created.body as { data: { order: { id: string } } }).data
      .order.id;
    const reference = initializedReferences.at(-1)!;
    const payment = await ctx.prisma.payment.findFirstOrThrow({
      where: { purposableId: orderId },
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: `evt_${reference}`,
        reference,
        amount: Number(payment.amountMinor),
        currency: 'NGN',
        status: 'success',
      },
    };
    const raw = JSON.stringify(payload);
    const signature = createHmac('sha512', PAYSTACK_TEST_SECRET)
      .update(raw)
      .digest('hex');

    await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature)
      .send(raw)
      .expect(200);
  };

  const heldTicketId = async (holderUserId: string): Promise<string> =>
    (
      await ctx.prisma.issuedTicket.findFirstOrThrow({
        where: { holderUserId, eventId, status: 'valid' },
      })
    ).id;

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

    ownerToken = await signIn(uniqueEmail('transfer-owner'));
    await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'Transfer Org',
        slug: `transfer-org-${run}`,
        category_id: category.id,
      })
      .expect(201);

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Transfer Night ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;

    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'Transfers under test.')
      .field('starts_at', '2027-11-01 20:00')
      .field('ends_at', '2027-11-02 02:00')
      .field('venue_name', 'Transfer Hall')
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
        quantity: 20,
        max_per_user: 1,
        status: 'on_sale',
      })
      .expect(201);
    gaTicketId = (ga.body as { data: { id: string } }).data.id;

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const senderEmail = uniqueEmail('sender');
    const recipientEmail = uniqueEmail('recipient');
    senderToken = await signIn(senderEmail);
    recipientToken = await signIn(recipientEmail);
    otherBuyerToken = await signIn(uniqueEmail('other-buyer'));

    senderId = await userIdFor(senderEmail);
    recipientId = await userIdFor(recipientEmail);

    await buyAndPay(senderToken, 1);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('transfers a held ticket to another user, rotating the code', async () => {
    const ticketId = await heldTicketId(senderId);
    const before = await ctx.prisma.issuedTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });

    const response = await request(server())
      .post(`/api/v1/attendee/tickets/${ticketId}/transfer`)
      .set('Authorization', auth(senderToken))
      .send({ to_user_id: recipientId })
      .expect(200);

    expect(response.body).toMatchObject({ message: 'Ticket transferred.' });

    const after = await ctx.prisma.issuedTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(after.holderUserId).toBe(recipientId);
    expect(after.code).not.toBe(before.code);

    const log = await ctx.prisma.ticketTransfer.findFirstOrThrow({
      where: { issuedTicketId: ticketId },
    });
    expect(log).toMatchObject({ fromUserId: senderId, toUserId: recipientId });

    const notification = await ctx.prisma.notification.findFirst({
      where: { userId: recipientId, type: 'attendee.ticket_transfer_received' },
    });
    expect(notification).not.toBeNull();
  });

  it('shows the ticket under the recipient and not the sender', async () => {
    const recipientTickets = await request(server())
      .get('/api/v1/attendee/tickets?status=valid')
      .set('Authorization', auth(recipientToken))
      .expect(200);
    expect(
      (recipientTickets.body as { data: { items: unknown[] } }).data.items,
    ).toHaveLength(1);

    const senderTickets = await request(server())
      .get('/api/v1/attendee/tickets?status=valid')
      .set('Authorization', auth(senderToken))
      .expect(200);
    expect(
      (senderTickets.body as { data: { items: unknown[] } }).data.items,
    ).toHaveLength(0);
  });

  it('rejects transferring a ticket you no longer hold', async () => {
    const ticketId = await heldTicketId(recipientId);

    await request(server())
      .post(`/api/v1/attendee/tickets/${ticketId}/transfer`)
      .set('Authorization', auth(senderToken))
      .send({ to_user_id: recipientId })
      .expect(404);
  });

  it('rejects transferring to yourself', async () => {
    const ticketId = await heldTicketId(recipientId);

    const response = await request(server())
      .post(`/api/v1/attendee/tickets/${ticketId}/transfer`)
      .set('Authorization', auth(recipientToken))
      .send({ to_user_id: recipientId })
      .expect(422);
    expect(response.body).toMatchObject({ code: 'cannot_transfer_to_self' });
  });

  it('enforces the recipient max-per-user cap', async () => {
    await buyAndPay(otherBuyerToken, 1);
    const otherBuyerId = (
      await ctx.prisma.issuedTicket.findFirstOrThrow({
        where: { eventId, holderUserId: { not: recipientId }, status: 'valid' },
      })
    ).holderUserId;
    const ticketId = await heldTicketId(otherBuyerId);

    const response = await request(server())
      .post(`/api/v1/attendee/tickets/${ticketId}/transfer`)
      .set('Authorization', auth(otherBuyerToken))
      .send({ to_user_id: recipientId })
      .expect(422);
    expect(response.body).toMatchObject({
      code: 'ticket_per_user_limit_exceeded',
    });
  });
});
