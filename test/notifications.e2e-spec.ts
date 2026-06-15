import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { PaystackProvider } from '../src/modules/payments/providers/paystack.provider';
import { ExpoPushService } from '../src/integrations/push/expo-push.service';
import { DailySalesDigestService } from '../src/modules/notifications/services/scheduled/daily-sales-digest.service';
import { StartingSoonService } from '../src/modules/notifications/services/scheduled/starting-soon.service';
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

describe('Notifications (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let buyerToken: string;
  let buyerId: string;
  let ownerId: string;
  let eventId: string;
  let eventSlug: string;
  let ticketId: string;
  const initializedReferences: string[] = [];
  const pushedMessages: Array<{ to: string; title: string }> = [];

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

  const meId = async (token: string): Promise<string> => {
    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(token))
      .expect(200);

    return (me.body as { data: { id: string } }).data.id;
  };

  const onboard = async (token: string, username: string): Promise<void> => {
    const interests = await ctx.prisma.interest.findMany({ take: 1 });

    await request(server())
      .post('/api/v1/onboarding/profile')
      .set('Authorization', auth(token))
      .send({
        first_name: 'Notify',
        last_name: 'Tester',
        username,
        gender: 'female',
        date_of_birth: '1998-05-05',
        latitude: 6.5,
        longitude: 3.4,
        place_name: 'Lagos',
        interests: [interests[0].id],
      })
      .expect(200);
  };

  const payForOrder = async (token: string, quantity: number) => {
    const order = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/orders`)
      .set('Authorization', auth(token))
      .send({
        items: [{ ticket_id: ticketId, quantity }],
        callback_url: 'cheevo:///orders/return',
      })
      .expect(200);

    const reference = initializedReferences.at(-1)!;
    const total = (order.body as { data: { order: { total_minor: number } } })
      .data.order.total_minor;
    const raw = JSON.stringify({
      event: 'charge.success',
      data: {
        id: `evt_${reference}`,
        reference,
        amount: total,
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
  };

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
            parseTransferWebhookEvent: () => null,
            createTransferRecipient: () => Promise.resolve('RCP_test'),
            transfer: () => Promise.reject(new Error('not used')),
          })
          .overrideProvider(ExpoPushService)
          .useValue({
            send: (messages: Array<{ to: string; title: string }>) => {
              pushedMessages.push(...messages);

              return Promise.resolve();
            },
          }),
    });

    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    const run = Date.now().toString(36);
    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();

    ownerToken = await signIn(uniqueEmail('notify-owner'));
    ownerId = await meId(ownerToken);
    await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'Notify Org',
        slug: `notify-org-${run}`,
        category_id: category.id,
      })
      .expect(201);

    buyerToken = await signIn(uniqueEmail('notify-buyer'));
    buyerId = await meId(buyerToken);
    await onboard(buyerToken, `notif_${run}`);

    await request(server())
      .post('/api/v1/notifications/push-tokens')
      .set('Authorization', auth(buyerToken))
      .send({
        token: `ExponentPushToken[buyer-${run}]`,
        audience: 'attendee',
        device_id: 'dev-1',
      })
      .expect(200);

    const orgRow = await ctx.prisma.organisation.findFirstOrThrow({
      where: { slug: `notify-org-${run}` },
    });
    await request(server())
      .post(`/api/v1/attendee/organisations/${orgRow.id}/subscribe`)
      .set('Authorization', auth(buyerToken))
      .expect(200);

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Notify Night ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;
    eventSlug = (event.body as { data: { slug: string } }).data.slug;

    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'Notifications under test.')
      .field('starts_at', '2027-12-15 20:00')
      .field('ends_at', '2027-12-16 02:00')
      .field('venue_name', 'Notify Hall')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'flyer.png',
        contentType: 'image/png',
      })
      .expect(200);

    const ticket = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/tickets`)
      .set('Authorization', auth(ownerToken))
      .send({ name: 'GA', gross_price: 200000, status: 'on_sale' })
      .expect(201);
    ticketId = (ticket.body as { data: { id: string } }).data.id;

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('fans out new-event notifications to subscribers on publish', async () => {
    const inbox = await request(server())
      .get('/api/v1/notifications')
      .query({ audience: 'attendee' })
      .set('Authorization', auth(buyerToken))
      .expect(200);

    const items = (
      inbox.body as {
        data: { items: Array<{ type: string; data: { event_id: string } }> };
      }
    ).data.items;

    const fanout = items.find(
      (item) =>
        item.type === 'attendee.new_event_from_subscription' &&
        item.data.event_id === eventId,
    );
    expect(fanout).toBeDefined();
    expect(
      pushedMessages.some((message) => message.title.startsWith('New from')),
    ).toBe(true);
  });

  it('notifies the buyer and the organiser on first sale', async () => {
    await payForOrder(buyerToken, 1);

    const buyerInbox = await request(server())
      .get('/api/v1/notifications')
      .query({ audience: 'attendee' })
      .set('Authorization', auth(buyerToken))
      .expect(200);
    const buyerItems = (
      buyerInbox.body as { data: { items: Array<{ type: string }> } }
    ).data.items;
    expect(buyerItems.some((item) => item.type === 'attendee.order_paid')).toBe(
      true,
    );

    const ownerInbox = await request(server())
      .get('/api/v1/notifications')
      .query({ audience: 'organizer' })
      .set('Authorization', auth(ownerToken))
      .expect(200);
    const ownerItems = (
      ownerInbox.body as { data: { items: Array<{ type: string }> } }
    ).data.items;
    expect(ownerItems.some((item) => item.type === 'order.first_sale')).toBe(
      true,
    );
  });

  it('tracks unread counts and read state', async () => {
    const before = await request(server())
      .get('/api/v1/notifications/unread-count')
      .query({ audience: 'attendee' })
      .set('Authorization', auth(buyerToken))
      .expect(200);
    const unread = (before.body as { data: { unread: number } }).data.unread;
    expect(unread).toBeGreaterThanOrEqual(2);

    const inbox = await request(server())
      .get('/api/v1/notifications')
      .query({ audience: 'attendee' })
      .set('Authorization', auth(buyerToken))
      .expect(200);
    const first = (inbox.body as { data: { items: Array<{ id: string }> } })
      .data.items[0];

    await request(server())
      .patch(`/api/v1/notifications/${first.id}/read`)
      .set('Authorization', auth(buyerToken))
      .expect(200);

    await request(server())
      .patch('/api/v1/notifications/does-not-exist-00000000000/read')
      .set('Authorization', auth(buyerToken))
      .expect(404);

    await request(server())
      .patch('/api/v1/notifications/read-all')
      .query({ audience: 'attendee' })
      .set('Authorization', auth(buyerToken))
      .expect(200);

    const after = await request(server())
      .get('/api/v1/notifications/unread-count')
      .query({ audience: 'attendee' })
      .set('Authorization', auth(buyerToken))
      .expect(200);
    expect((after.body as { data: { unread: number } }).data.unread).toBe(0);
  });

  it('notifies parent authors on replies, once, respecting self-replies', async () => {
    const parent = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/comments`)
      .set('Authorization', auth(buyerToken))
      .send({ body: 'Who else is going?' })
      .expect(200);
    const parentId = (parent.body as { data: { id: string } }).data.id;

    await request(server())
      .post(`/api/v1/attendee/events/${eventId}/comments`)
      .set('Authorization', auth(buyerToken))
      .send({ body: 'Bumping my own comment', parent_id: parentId })
      .expect(200);

    let count = await ctx.prisma.notification.count({
      where: { userId: buyerId, type: 'attendee.comment_reply' },
    });
    expect(count).toBe(0);

    await request(server())
      .post(`/api/v1/attendee/events/${eventId}/comments`)
      .set('Authorization', auth(ownerToken))
      .send({ body: 'I will be there!', parent_id: parentId })
      .expect(200);

    count = await ctx.prisma.notification.count({
      where: { userId: buyerId, type: 'attendee.comment_reply' },
    });
    expect(count).toBe(1);

    await request(server())
      .post(`/api/v1/attendee/events/${eventId}/comments`)
      .set('Authorization', auth(ownerToken))
      .send({ body: 'Another reply', parent_id: parentId })
      .expect(200);

    count = await ctx.prisma.notification.count({
      where: { userId: buyerId, type: 'attendee.comment_reply' },
    });
    expect(count).toBe(1);
  });

  it('manages preferences and disables channels', async () => {
    const prefs = await request(server())
      .get('/api/v1/notifications/preferences')
      .query({ audience: 'attendee' })
      .set('Authorization', auth(buyerToken))
      .expect(200);

    const types = (
      prefs.body as {
        data: {
          types: Array<{
            type: string;
            channels: Array<{ channel: string; enabled: boolean }>;
          }>;
        };
      }
    ).data.types;
    expect(types.length).toBe(4);
    expect(types.every((row) => row.type.startsWith('attendee.'))).toBe(true);

    const orderPaid = types.find((row) => row.type === 'attendee.order_paid')!;
    expect(orderPaid.channels.find((c) => c.channel === 'inapp')?.enabled).toBe(
      true,
    );
    expect(orderPaid.channels.find((c) => c.channel === 'email')?.enabled).toBe(
      false,
    );

    await request(server())
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', auth(buyerToken))
      .send({
        preferences: [
          { type: 'attendee.order_paid', channel: 'inapp', enabled: false },
          { type: 'attendee.order_paid', channel: 'push', enabled: false },
        ],
      })
      .expect(200);

    const countBefore = await ctx.prisma.notification.count({
      where: { userId: buyerId, type: 'attendee.order_paid' },
    });

    await payForOrder(buyerToken, 1);

    const countAfter = await ctx.prisma.notification.count({
      where: { userId: buyerId, type: 'attendee.order_paid' },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('suppresses push during quiet hours but keeps inapp', async () => {
    await request(server())
      .patch('/api/v1/notifications/quiet-hours')
      .set('Authorization', auth(buyerToken))
      .send({ audience: 'attendee', start: '00:00', end: '23:59', timezone: 'UTC' })
      .expect(200);

    const pushCountBefore = pushedMessages.length;
    const inappBefore = await ctx.prisma.notification.count({
      where: { userId: buyerId, type: 'attendee.comment_reply' },
    });

    const parent = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/comments`)
      .set('Authorization', auth(buyerToken))
      .send({ body: 'Quiet hours test' })
      .expect(200);

    await request(server())
      .post(`/api/v1/attendee/events/${eventId}/comments`)
      .set('Authorization', auth(ownerToken))
      .send({
        body: 'Reply during quiet hours',
        parent_id: (parent.body as { data: { id: string } }).data.id,
      })
      .expect(200);

    const inappAfter = await ctx.prisma.notification.count({
      where: { userId: buyerId, type: 'attendee.comment_reply' },
    });
    expect(inappAfter).toBe(inappBefore + 1);
    expect(
      pushedMessages
        .slice(pushCountBefore)
        .filter((message) => message.title === 'New reply on your comment'),
    ).toHaveLength(0);

    await request(server())
      .patch('/api/v1/notifications/quiet-hours')
      .set('Authorization', auth(buyerToken))
      .send({ audience: 'attendee' })
      .expect(200);
  });

  it('mutes an event and reflects it in the detail flags', async () => {
    const muted = await request(server())
      .post(`/api/v1/notifications/events/${eventId}/mute`)
      .set('Authorization', auth(buyerToken))
      .expect(200);
    expect(muted.body).toMatchObject({ data: { muted: true } });

    const detail = await request(server())
      .get(`/api/v1/attendee/events/${eventSlug}`)
      .set('Authorization', auth(buyerToken))
      .expect(200);
    expect(detail.body).toMatchObject({ data: { is_muted: true } });

    const unmuted = await request(server())
      .post(`/api/v1/notifications/events/${eventId}/mute`)
      .set('Authorization', auth(buyerToken))
      .expect(200);
    expect(unmuted.body).toMatchObject({ data: { muted: false } });
  });

  it('sends starting-soon reminders to organisers and attendees once', async () => {
    const startsAt = new Date(Date.now() + 24 * 3_600_000);
    await ctx.prisma.event.update({
      where: { id: eventId },
      data: { startsAt },
    });

    const scheduled = ctx.app.get(StartingSoonService);

    expect(await scheduled.run()).toBe(1);

    const ownerCount = await ctx.prisma.notification.count({
      where: { userId: ownerId, type: 'event.starting_soon' },
    });
    expect(ownerCount).toBe(1);

    const buyerCount = await ctx.prisma.notification.count({
      where: { userId: buyerId, type: 'attendee.event_starting_soon' },
    });
    expect(buyerCount).toBe(1);

    expect(await scheduled.run()).toBe(0);
  });

  it('sends the daily sales digest by email once per day', async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    await ctx.prisma.order.updateMany({
      where: { eventId, status: 'paid' },
      data: { paidAt: yesterday },
    });

    const mailsBefore = ctx.mails.length;
    const scheduled = ctx.app.get(DailySalesDigestService);

    expect(await scheduled.run()).toBe(1);

    const digestMails = ctx.mails
      .slice(mailsBefore)
      .filter((mail) => mail.template === 'daily-sales-digest');
    expect(digestMails.length).toBeGreaterThan(0);

    expect(await scheduled.run()).toBe(0);
  });
});
