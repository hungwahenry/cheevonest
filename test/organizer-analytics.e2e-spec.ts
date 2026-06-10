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

const PAYSTACK_TEST_SECRET = 'sk_test_secret';

describe('Organizer analytics & exports (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let buyerToken: string;
  let buyerEmail: string;
  let orgId: string;
  let eventId: string;
  let ticketId: string;
  const initializedReferences: string[] = [];

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const eventPath = () => `/api/v1/organizer/events/${eventId}`;

  const signIn = async (email: string): Promise<string> => {
    await ctx.prisma.otpCode.deleteMany({ where: { email } });
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const onboard = async (token: string, username: string): Promise<void> => {
    const interests = await ctx.prisma.interest.findMany({ take: 1 });

    await request(server())
      .post('/api/v1/onboarding/profile')
      .set('Authorization', auth(token))
      .send({
        first_name: 'Ana',
        last_name: 'Lytics',
        username,
        gender: 'female',
        date_of_birth: '1997-07-07',
        latitude: 6.5,
        longitude: 3.4,
        place_name: 'Lagos',
        city: 'Lagos',
        interests: [interests[0].id],
      })
      .expect(200);
  };

  beforeAll(async () => {
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
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

    ownerToken = await signIn(uniqueEmail('ana-owner'));
    const org = await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'Analytics Org',
        slug: `ana-org-${run}`,
        category_id: category.id,
      })
      .expect(201);
    orgId = (org.body as { data: { id: string } }).data.id;

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Analytics Live ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;

    await request(server())
      .patch(eventPath())
      .set('Authorization', auth(ownerToken))
      .field('description', 'Analytics under test.')
      .field('starts_at', '2027-12-28 20:00')
      .field('ends_at', '2027-12-29 02:00')
      .field('venue_name', 'Chart Hall')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'flyer.png',
        contentType: 'image/png',
      })
      .expect(200);

    const ticket = await request(server())
      .post(`${eventPath()}/tickets`)
      .set('Authorization', auth(ownerToken))
      .send({ name: 'GA', gross_price: 300000, status: 'on_sale' })
      .expect(201);
    ticketId = (ticket.body as { data: { id: string } }).data.id;

    await request(server())
      .post(`${eventPath()}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    buyerEmail = uniqueEmail('ana-buyer');
    buyerToken = await signIn(buyerEmail);
    await onboard(buyerToken, `ana_${run}`);

    const order = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/orders`)
      .set('Authorization', auth(buyerToken))
      .send({
        items: [{ ticket_id: ticketId, quantity: 2 }],
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

    const rsvperToken = await signIn(uniqueEmail('ana-rsvper'));
    await request(server())
      .post(`/api/v1/attendee/events/${eventId}/rsvp`)
      .set('Authorization', auth(rsvperToken))
      .expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('serves the organisation dashboard with kpis, series, and activity', async () => {
    const response = await request(server())
      .get(`/api/v1/organizer/organisations/${orgId}/dashboard?range=30d`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const data = (
      response.body as {
        data: {
          range: string;
          kpis: Record<string, { current: number }>;
          timeseries: unknown[];
          top_events: Array<{
            id: string;
            revenue_minor: number;
            share_pct: number;
          }>;
          next_event: { id: string };
          recent_activity: Array<{ type: string }>;
        };
      }
    ).data;

    expect(data.range).toBe('30d');
    expect(data.kpis.revenue_minor.current).toBe(600000);
    expect(data.kpis.tickets.current).toBe(2);
    expect(data.kpis.orders.current).toBe(1);
    expect(data.kpis.rsvps.current).toBe(1);
    expect(data.timeseries).toHaveLength(30);
    expect(data.top_events[0]).toMatchObject({
      id: eventId,
      revenue_minor: 600000,
      share_pct: 100,
    });
    expect(data.next_event.id).toBe(eventId);

    const types = data.recent_activity.map((entry) => entry.type);
    expect(types).toContain('order_paid');
    expect(types).toContain('rsvp');
  });

  it('serves event analytics with series and top cities', async () => {
    const response = await request(server())
      .get(`${eventPath()}/analytics`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const data = (
      response.body as {
        data: {
          currency: string;
          daily_series: Array<{ tickets_sold: number; revenue_minor: number }>;
          cumulative_series: Array<{ tickets_sold: number }>;
          top_cities: Array<{ city: string; buyers_count: number }>;
        };
      }
    ).data;

    expect(data.currency).toBe('NGN');
    expect(data.daily_series.at(-1)).toMatchObject({
      tickets_sold: 2,
      revenue_minor: 600000,
    });
    expect(data.cumulative_series.at(-1)).toMatchObject({ tickets_sold: 2 });
    expect(data.top_cities).toEqual([{ city: 'Lagos', buyers_count: 1 }]);
  });

  it('serves the sales summary with per-ticket breakdown', async () => {
    const response = await request(server())
      .get(`${eventPath()}/sales`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    expect(response.body).toMatchObject({
      data: {
        revenue_minor: 600000,
        orders_count: 1,
        tickets_sold: 2,
        per_ticket: [
          {
            ticket_id: ticketId,
            name: 'GA',
            sold_count: 2,
            revenue_minor: 600000,
          },
        ],
      },
    });

    const data = (
      response.body as { data: { gross_minor: number; fees_minor: number } }
    ).data;
    expect(data.gross_minor).toBe(data.fees_minor + 600000);
  });

  it('lists event orders with buyer info and rsvps', async () => {
    const orders = await request(server())
      .get(`${eventPath()}/orders?status=paid`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const items = (
      orders.body as {
        data: { items: Array<{ id: string; buyer: { email: string } }> };
      }
    ).data.items;
    expect(items).toHaveLength(1);
    expect(items[0].buyer.email).toBe(buyerEmail);

    await request(server())
      .get(`${eventPath()}/orders/${items[0].id}`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const rsvps = await request(server())
      .get(`${eventPath()}/rsvps`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const rsvpItems = (
      rsvps.body as { data: { items: Array<{ rsvped_at: string }> } }
    ).data.items;
    expect(rsvpItems).toHaveLength(1);
    expect(rsvpItems[0].rsvped_at).toBeTruthy();
  });

  it('exports orders as csv, xlsx, and pdf', async () => {
    const csv = await request(server())
      .get(`${eventPath()}/orders/export`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toContain('orders');
    expect(csv.headers['content-disposition']).toContain('.csv');
    expect(csv.text).toContain('Order ID');
    expect(csv.text).toContain(buyerEmail);
    expect(csv.text).toContain('6000.00');

    const xlsx = await request(server())
      .get(`${eventPath()}/orders/export?format=xlsx`)
      .set('Authorization', auth(ownerToken))
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');

    const pdf = await request(server())
      .get(`${eventPath()}/orders/export?format=pdf`)
      .set('Authorization', auth(ownerToken))
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('exports rsvps and issued tickets', async () => {
    const rsvps = await request(server())
      .get(`${eventPath()}/rsvps/export`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    expect(rsvps.text).toContain('Display Name');

    const tickets = await request(server())
      .get(`${eventPath()}/issued-tickets/export`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    expect(tickets.text).toContain('Ticket Code');
    expect(tickets.text).toContain(buyerEmail);
  });

  it('denies analytics to non-members', async () => {
    await request(server())
      .get(`/api/v1/organizer/organisations/${orgId}/dashboard`)
      .set('Authorization', auth(buyerToken))
      .expect(404);

    await request(server())
      .get(`${eventPath()}/sales`)
      .set('Authorization', auth(buyerToken))
      .expect(403);
  });

  it('returns the attendee data export', async () => {
    const response = await request(server())
      .get('/api/v1/attendee/data-export')
      .set('Authorization', auth(buyerToken))
      .expect(200);

    const data = (
      response.body as {
        data: {
          account: { email: string };
          profile: { username: string | null; city: string | null };
          interests: unknown[];
          orders: Array<{ total_minor: number }>;
          tickets: unknown[];
          notification_preferences: unknown[];
        };
      }
    ).data;

    expect(data.account.email).toBe(buyerEmail);
    expect(data.profile.city).toBe('Lagos');
    expect(data.interests.length).toBeGreaterThan(0);
    expect(data.orders[0].total_minor).toBeGreaterThan(600000);
    expect(data.tickets).toHaveLength(2);
  });
});
