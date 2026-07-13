import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { PaystackProvider } from '../src/modules/payments/providers/paystack/paystack.provider';
import { BankResolverService } from '../src/modules/payouts/services/bank-resolver.service';
import { PayoutsService } from '../src/modules/payouts/services/payouts.service';
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

describe('Payouts (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let adminToken: string;
  let buyerToken: string;
  let orgId: string;
  let eventId: string;
  let ticketId: string;
  const initializedReferences: string[] = [];
  const transfers: Array<{ reference: string; amountMinor: number }> = [];

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const orgPath = () => `/api/v1/organizer/organisations/${orgId}`;

  const signIn = async (email: string): Promise<string> => {
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const transferWebhook = (payload: Record<string, unknown>) => {
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

  const requestPayout = (amountMinor: number) =>
    request(server())
      .post(`${orgPath()}/payouts`)
      .set('Authorization', auth(ownerToken))
      .send({ amount_minor: amountMinor });

  beforeAll(async () => {
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
    ctx = await createTestApp({
      overrides: (builder: TestingModuleBuilder) =>
        builder
          .overrideProvider(PaystackProvider)
          .useValue({
            name: () => 'paystack',
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
            parseTransferWebhookEvent: (payload: Record<string, unknown>) => {
              const event =
                typeof payload.event === 'string' ? payload.event : '';

              if (
                ![
                  'transfer.success',
                  'transfer.failed',
                  'transfer.reversed',
                ].includes(event)
              ) {
                return null;
              }

              const data = payload.data as Record<string, unknown>;
              const status =
                event === 'transfer.success'
                  ? 'paid'
                  : event === 'transfer.reversed'
                    ? 'reversed'
                    : 'failed';

              return {
                reference: String(data.reference),
                providerReference: null,
                status,
                failureReason:
                  status === 'paid'
                    ? null
                    : typeof data.reason === 'string'
                      ? data.reason
                      : 'transfer failed',
                providerResponse: data,
              };
            },
            createTransferRecipient: () => Promise.resolve('RCP_test'),
            transfer: (req: { reference: string; amountMinor: number }) => {
              transfers.push({
                reference: req.reference,
                amountMinor: req.amountMinor,
              });

              return Promise.resolve({
                providerReference: `TRF_${req.reference}`,
                status: 'processing',
                providerResponse: {},
              });
            },
            verifyTransfer: (reference: string) =>
              Promise.resolve({
                reference,
                providerReference: null,
                status: 'paid',
                failureReason: null,
                providerResponse: {},
              }),
          })
          .overrideProvider(BankResolverService)
          .useValue({
            banks: () =>
              Promise.resolve([
                { code: '058', name: 'Guaranty Trust Bank', slug: 'gtbank' },
              ]),
            bankName: () => Promise.resolve('Guaranty Trust Bank'),
            resolve: (accountNumber: string) =>
              Promise.resolve({
                account_number: accountNumber,
                account_name: 'CHEEVO TEST ORG',
                bank_code: '058',
              }),
          }),
    });

    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    await ctx.prisma.systemConfig.update({
      where: { key: 'payouts.hold_window_days' },
      data: { value: { v: 0 } },
    });

    const run = Date.now().toString(36);
    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();

    ownerToken = await signIn(uniqueEmail('payout-owner'));
    const org = await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'Payout Org',
        slug: `payout-org-${run}`,
        category_id: category.id,
      })
      .expect(201);
    orgId = (org.body as { data: { id: string } }).data.id;

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Payout Fest ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;

    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'Payouts under test.')
      .field('starts_at', '2027-12-01 20:00')
      .field('ends_at', '2027-12-02 02:00')
      .field('venue_name', 'Payout Hall')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'flyer.png',
        contentType: 'image/png',
      })
      .expect(200);

    const ticket = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/tickets`)
      .set('Authorization', auth(ownerToken))
      .send({ name: 'GA', gross_price: 1000000, status: 'on_sale' })
      .expect(201);
    ticketId = (ticket.body as { data: { id: string } }).data.id;

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    buyerToken = await signIn(uniqueEmail('payout-buyer'));
    const order = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/orders`)
      .set('Authorization', auth(buyerToken))
      .send({
        items: [{ ticket_id: ticketId, quantity: 2 }],
        callback_url: 'cheevo:///orders/return',
      })
      .expect(200);

    const reference = initializedReferences.at(-1)!;
    const totalMinor = (
      order.body as { data: { order: { total_minor: number } } }
    ).data.order.total_minor;

    await transferWebhook({
      event: 'charge.success',
      data: {
        id: `evt_${reference}`,
        reference,
        amount: totalMinor,
        currency: 'NGN',
        status: 'success',
      },
    }).expect(200);

    adminToken = await signIn(uniqueEmail('payout-admin'));
    const adminMe = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(adminToken))
      .expect(200);
    await ctx.prisma.user.update({
      where: { id: (adminMe.body as { data: { id: string } }).data.id },
      data: { role: 'admin' },
    });
  });

  afterAll(async () => {
    await ctx.prisma.systemConfig.update({
      where: { key: 'payouts.hold_window_days' },
      data: { value: { v: 2 } },
    });
    await ctx.app.close();
  });

  it('guards admin endpoints by role', async () => {
    const denied = await request(server())
      .get('/api/v1/admin/payouts')
      .set('Authorization', auth(ownerToken))
      .expect(403);

    expect(denied.body).toMatchObject({ message: 'Admin access required.' });
  });

  it('shows the balance with settled revenue', async () => {
    const response = await request(server())
      .get(`${orgPath()}/balance`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    expect(response.body).toMatchObject({
      data: {
        currency: 'NGN',
        available_minor: 2000000,
        paid_out_minor: 0,
        hold_window_days: 0,
      },
    });

    const perEvent = (
      response.body as {
        data: { per_event: Array<{ event_id: string; revenue_minor: number }> };
      }
    ).data.per_event;
    expect(perEvent.some((row) => row.event_id === eventId)).toBe(true);
  });

  it('requires a payout account before requesting', async () => {
    const response = await requestPayout(100000).expect(422);

    expect(response.body).toMatchObject({ code: 'payout_account_missing' });
  });

  it('saves a payout account via bank resolution', async () => {
    const response = await request(server())
      .put(`${orgPath()}/payout-account`)
      .set('Authorization', auth(ownerToken))
      .send({ bank_code: '058', account_number: '0123456789' })
      .expect(200);

    expect(response.body).toMatchObject({
      message: 'Payout account saved.',
      data: {
        bank_code: '058',
        bank_name: 'Guaranty Trust Bank',
        account_name: 'CHEEVO TEST ORG',
      },
    });

    const banks = await request(server())
      .get('/api/v1/organizer/payouts/banks')
      .set('Authorization', auth(ownerToken))
      .expect(200);
    expect((banks.body as { data: Array<{ code: string }> }).data[0].code).toBe(
      '058',
    );
  });

  it('validates payout requests', async () => {
    const tooMuch = await requestPayout(99999999).expect(422);
    expect(tooMuch.body).toMatchObject({ code: 'insufficient_balance' });
  });

  it('initiates the payout automatically and settles via webhook', async () => {
    const created = await requestPayout(1000000).expect(201);
    const payoutId = (created.body as { data: { id: string } }).data.id;

    // Auto-initiated at request time — no admin approval step.
    expect(created.body).toMatchObject({
      message: 'Payout initiated.',
      data: { status: 'processing', amount_minor: 1000000, fees_minor: 2500 },
    });
    expect(transfers.at(-1)?.amountMinor).toBe(997500);

    const duplicate = await requestPayout(100000).expect(409);
    expect(duplicate.body).toMatchObject({ code: 'payout_already_in_flight' });

    const { providerReference } = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    const reference = providerReference!;

    await transferWebhook({
      event: 'transfer.failed',
      data: {
        id: `tr_${reference}_f`,
        reference,
        reason: 'insufficient balance',
      },
    }).expect(200);

    const failed = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(failed.status).toBe('failed');
    expect(failed.failedReason).toBe('insufficient balance');

    const retried = await request(server())
      .post(`/api/v1/admin/payouts/${payoutId}/retry`)
      .set('Authorization', auth(adminToken))
      .expect(200);
    expect(retried.body).toMatchObject({ data: { status: 'processing' } });

    await transferWebhook({
      event: 'transfer.success',
      data: { id: `tr_${reference}_s`, reference },
    }).expect(200);

    const paid = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(paid.status).toBe('paid');

    const balance = await request(server())
      .get(`${orgPath()}/balance`)
      .set('Authorization', auth(ownerToken))
      .expect(200);
    expect(balance.body).toMatchObject({
      data: { available_minor: 1000000, paid_out_minor: 1000000 },
    });
  });

  it('only allows retry once a payout has failed', async () => {
    const created = await requestPayout(500000).expect(201);
    const payoutId = (created.body as { data: { id: string } }).data.id;
    expect(created.body).toMatchObject({ data: { status: 'processing' } });

    // Retry is rejected while the transfer is still processing.
    const retryDenied = await request(server())
      .post(`/api/v1/admin/payouts/${payoutId}/retry`)
      .set('Authorization', auth(adminToken))
      .expect(409);
    expect(retryDenied.body).toMatchObject({ code: 'payout_not_retryable' });

    const { providerReference } = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    const reference = providerReference!;

    await transferWebhook({
      event: 'transfer.success',
      data: { id: `tr_${reference}_s`, reference },
    }).expect(200);

    const paid = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(paid.status).toBe('paid');
  });

  it('lists payouts for organizers and admins', async () => {
    const organizerList = await request(server())
      .get(`${orgPath()}/payouts`)
      .set('Authorization', auth(ownerToken))
      .expect(200);
    expect(
      (organizerList.body as { data: { items: unknown[] } }).data.items.length,
    ).toBeGreaterThanOrEqual(2);

    const adminList = await request(server())
      .get(`/api/v1/admin/payouts?status=paid&organisation_id=${orgId}`)
      .set('Authorization', auth(adminToken))
      .expect(200);

    const items = (
      adminList.body as {
        data: {
          items: Array<{ status: string; organisation: { id: string } }>;
        };
      }
    ).data.items;
    expect(items.length).toBe(2);
    expect(items.every((item) => item.status === 'paid')).toBe(true);
    expect(items.every((item) => item.organisation.id === orgId)).toBe(true);
  });

  it('fails a settled payout when the provider reverses it', async () => {
    const created = await requestPayout(300000).expect(201);
    const payoutId = (created.body as { data: { id: string } }).data.id;

    const { providerReference } = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    const reference = providerReference!;

    await transferWebhook({
      event: 'transfer.success',
      data: { id: `tr_${reference}_s`, reference },
    }).expect(200);
    expect(
      (
        await ctx.prisma.payout.findUniqueOrThrow({ where: { id: payoutId } })
      ).status,
    ).toBe('paid');

    await transferWebhook({
      event: 'transfer.reversed',
      data: { id: `tr_${reference}_r`, reference, reason: 'bank returned funds' },
    }).expect(200);

    const reversed = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(reversed.status).toBe('failed');
    expect(reversed.failedReason).toBe('bank returned funds');
    expect(reversed.paidAt).toBeNull();

    // The reversed amount is available to request again.
    const balance = await request(server())
      .get(`${orgPath()}/balance`)
      .set('Authorization', auth(ownerToken))
      .expect(200);
    expect(
      (balance.body as { data: { available_minor: number } }).data
        .available_minor,
    ).toBe(500000);
  });

  it('recovers a stranded payout by pull-verifying the transfer', async () => {
    const created = await requestPayout(200000).expect(201);
    const payoutId = (created.body as { data: { id: string } }).data.id;
    expect(created.body).toMatchObject({ data: { status: 'processing' } });

    // No webhook is delivered; reconcile pulls the truth from the provider.
    const payout = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    await ctx.app.get(PayoutsService).reconcile(payout);

    const reconciled = await ctx.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(reconciled.status).toBe('paid');
  });

  it('alerts admins on payout requests and failures', async () => {
    const requested = await ctx.prisma.notification.count({
      where: { type: 'admin.payout_requested' },
    });
    expect(requested).toBeGreaterThan(0);

    const failed = await ctx.prisma.notification.count({
      where: { type: 'admin.payout_failed' },
    });
    expect(failed).toBeGreaterThan(0);

    const emailed = ctx.mails.some((mail) => mail.template === 'admin-alert');
    expect(emailed).toBe(true);
  });
});
