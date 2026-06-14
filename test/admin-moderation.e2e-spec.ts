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

describe('Admin moderation (e2e)', () => {
  let ctx: TestContext;
  let adminToken: string;
  let ownerToken: string;
  let ownerId: string;
  let memberToken: string;
  let memberId: string;
  let orgId: string;
  let eventId: string;
  let ticketId: string;
  const initializedReferences: string[] = [];

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;

  const signIn = async (email: string): Promise<string> => {
    await ctx.prisma.otpCode.deleteMany({ where: { email } });
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const res = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (res.body as { data: { token: string } }).data.token;
  };

  const meId = async (token: string): Promise<string> => {
    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(token))
      .expect(200);

    return (me.body as { data: { id: string } }).data.id;
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
          verify: () => Promise.reject(new Error('unused')),
          verifyWebhookSignature: (raw: Buffer | string, sig?: string) =>
            sig ===
            createHmac('sha512', PAYSTACK_TEST_SECRET)
              .update(raw)
              .digest('hex'),
          parseWebhookEvent: (payload: Record<string, unknown>) => {
            if (payload.event !== 'charge.success') return null;
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
          transfer: () => Promise.reject(new Error('unused')),
        }),
    });

    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    const run = Date.now().toString(36);
    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();

    adminToken = await signIn(uniqueEmail('admin'));
    await ctx.prisma.user.update({
      where: { id: await meId(adminToken) },
      data: { role: 'admin' },
    });

    ownerToken = await signIn(uniqueEmail('mod-owner'));
    ownerId = await meId(ownerToken);
    const org = await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'Mod Org',
        slug: `mod-org-${run}`,
        category_id: category.id,
      })
      .expect(201);
    orgId = (org.body as { data: { id: string } }).data.id;

    memberToken = await signIn(uniqueEmail('mod-member'));
    memberId = await meId(memberToken);
    const interests = await ctx.prisma.interest.findMany({ take: 1 });
    await request(server())
      .post('/api/v1/onboarding/profile')
      .set('Authorization', auth(memberToken))
      .send({
        first_name: 'Mem',
        last_name: 'Ber',
        username: `mem_${run}`,
        gender: 'male',
        date_of_birth: '1995-01-01',
        latitude: 6.5,
        longitude: 3.4,
        place_name: 'Lagos',
        interests: [interests[0].id],
      })
      .expect(200);
    await request(server())
      .post(`/api/v1/organizer/organisations/${orgId}/members`)
      .set('Authorization', auth(ownerToken))
      .send({
        email: (
          await ctx.prisma.user.findUniqueOrThrow({ where: { id: memberId } })
        ).email,
      })
      .expect(201);

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Mod Night ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;
    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'Mod test.')
      .field('starts_at', '2028-01-01 20:00')
      .field('ends_at', '2028-01-02 02:00')
      .field('venue_name', 'Hall')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'f.png',
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
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('denies all admin endpoints to non-admins', async () => {
    await request(server())
      .get('/api/v1/admin/users')
      .set('Authorization', auth(ownerToken))
      .expect(403);
    await request(server())
      .get(`/api/v1/admin/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .expect(403);
  });

  it('serves a user 360 with stats and connections', async () => {
    const res = await request(server())
      .get(`/api/v1/admin/users/${ownerId}`)
      .set('Authorization', auth(adminToken))
      .expect(200);

    const data = (
      res.body as {
        data: {
          id: string;
          stats: { active_sessions: number };
          organisations: Array<Record<string, unknown>>;
          audit_trail: unknown[];
        };
      }
    ).data;
    expect(data.id).toBe(ownerId);
    expect(typeof data.stats.active_sessions).toBe('number');
    expect(data.organisations[0]).toMatchObject({
      type: 'organisation',
      id: orgId,
      role: 'owner',
      deep_link: `/admin/organisations/${orgId}`,
    });
    expect(Array.isArray(data.audit_trail)).toBe(true);
  });

  it('suspends a user, kills sessions, and records an audit row', async () => {
    const res = await request(server())
      .post(`/api/v1/admin/users/${memberId}/suspend`)
      .set('Authorization', auth(adminToken))
      .send({ reason: 'spam behaviour' })
      .expect(200);
    expect(res.body).toMatchObject({
      message: 'User suspended.',
      data: { suspended_reason: 'spam behaviour' },
    });

    await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(memberToken))
      .expect(401);

    const stored = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: memberId },
    });
    expect(stored.suspendedAt).not.toBeNull();

    const audit = await ctx.prisma.adminAction.findFirst({
      where: { action: 'users.suspend', targetId: memberId },
    });
    expect(audit).toMatchObject({
      reason: 'spam behaviour',
      targetType: 'user',
    });
    expect(audit?.ip).toBeTruthy();
    expect(audit?.requestId).toBeTruthy();

    await request(server())
      .post(`/api/v1/admin/users/${memberId}/unsuspend`)
      .set('Authorization', auth(adminToken))
      .expect(200);
  });

  it('does NOT record an audit row when a mutation fails', async () => {
    const before = await ctx.prisma.adminAction.count({
      where: { action: 'organisations.unsuspend' },
    });
    await request(server())
      .post(`/api/v1/admin/organisations/${orgId}/unsuspend`)
      .set('Authorization', auth(adminToken))
      .expect(409);
    const after = await ctx.prisma.adminAction.count({
      where: { action: 'organisations.unsuspend' },
    });
    expect(after).toBe(before);
  });

  it('serves an org 360 and changes owner with member-guard', async () => {
    const res = await request(server())
      .get(`/api/v1/admin/organisations/${orgId}`)
      .set('Authorization', auth(adminToken))
      .expect(200);
    const data = (
      res.body as {
        data: {
          stats: { members_count: number };
          members: Array<{ role: string }>;
        };
      }
    ).data;
    expect(data.stats.members_count).toBe(2);
    expect(data.members.map((m) => m.role).sort()).toEqual(['member', 'owner']);

    const stranger = await signIn(uniqueEmail('stranger'));
    const strangerId = await meId(stranger);
    const denied = await request(server())
      .post(`/api/v1/admin/organisations/${orgId}/change-owner`)
      .set('Authorization', auth(adminToken))
      .send({ user_id: strangerId })
      .expect(422);
    expect(denied.body).toMatchObject({ code: 'owner_candidate_not_member' });

    await request(server())
      .post(`/api/v1/admin/organisations/${orgId}/change-owner`)
      .set('Authorization', auth(adminToken))
      .send({ user_id: memberId, reason: 'ownership transfer' })
      .expect(200);
    const role = await ctx.prisma.organisationMember.findUniqueOrThrow({
      where: {
        organisationId_userId: { organisationId: orgId, userId: memberId },
      },
    });
    expect(role.role).toBe('owner');
  });

  it('serves an event 360 and runs lifecycle ops with guards', async () => {
    const res = await request(server())
      .get(`/api/v1/admin/events/${eventId}`)
      .set('Authorization', auth(adminToken))
      .expect(200);
    const data = (
      res.body as {
        data: {
          organisation: { id: string };
          ticket_types: Array<{ id: string }>;
        };
      }
    ).data;
    expect(data.organisation.id).toBe(orgId);
    expect(data.ticket_types).toHaveLength(1);
    expect(data.ticket_types[0].id).toBe(ticketId);

    await request(server())
      .post(`/api/v1/admin/events/${eventId}/lock-comments`)
      .set('Authorization', auth(adminToken))
      .expect(200);
    const relock = await request(server())
      .post(`/api/v1/admin/events/${eventId}/lock-comments`)
      .set('Authorization', auth(adminToken))
      .expect(409);
    expect(relock.body).toMatchObject({
      code: 'event_comments_already_locked',
    });

    await request(server())
      .post(`/api/v1/admin/events/${eventId}/unpublish`)
      .set('Authorization', auth(adminToken))
      .expect(200);
    expect(
      (await ctx.prisma.event.findUniqueOrThrow({ where: { id: eventId } }))
        .status,
    ).toBe('draft');
  });

  it('lists the audit log with admin refs and filters by target', async () => {
    const res = await request(server())
      .get(
        `/api/v1/admin/audit-log?target_type=organisation&target_id=${orgId}`,
      )
      .set('Authorization', auth(adminToken))
      .expect(200);
    const items = (
      res.body as {
        data: {
          items: Array<{
            target_id: string;
            admin: Record<string, unknown>;
            action: string;
          }>;
        };
      }
    ).data.items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.target_id === orgId)).toBe(true);
    expect(items[0].admin).toMatchObject({ type: 'user' });
    expect(items.some((i) => i.action === 'organisations.change_owner')).toBe(
      true,
    );
  });

  it('force-deletes an event with sales (admin bypasses the organizer guard)', async () => {
    const run = Date.now().toString(36);
    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Del Night ${run}` })
      .expect(201);
    const delId = (event.body as { data: { id: string } }).data.id;
    await request(server())
      .patch(`/api/v1/organizer/events/${delId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'Del test.')
      .field('starts_at', '2028-02-01 20:00')
      .field('ends_at', '2028-02-02 02:00')
      .field('venue_name', 'Hall')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'f.png',
        contentType: 'image/png',
      })
      .expect(200);
    const t = await request(server())
      .post(`/api/v1/organizer/events/${delId}/tickets`)
      .set('Authorization', auth(ownerToken))
      .send({ name: 'GA', gross_price: 100000, status: 'on_sale' })
      .expect(201);
    await request(server())
      .post(`/api/v1/organizer/events/${delId}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const buyer = await signIn(uniqueEmail('del-buyer'));
    const order = await request(server())
      .post(`/api/v1/attendee/events/${delId}/orders`)
      .set('Authorization', auth(buyer))
      .send({
        items: [
          {
            ticket_id: (t.body as { data: { id: string } }).data.id,
            quantity: 1,
          },
        ],
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

    const orgBefore = await ctx.prisma.organisation.findUniqueOrThrow({
      where: { id: orgId },
    });

    await request(server())
      .delete(`/api/v1/admin/events/${delId}`)
      .set('Authorization', auth(adminToken))
      .send({ reason: 'fraudulent event' })
      .expect(200);

    expect(
      await ctx.prisma.event.findUnique({ where: { id: delId } }),
    ).toBeNull();
    const orgAfter = await ctx.prisma.organisation.findUniqueOrThrow({
      where: { id: orgId },
    });
    expect(orgAfter.eventsCount).toBe(orgBefore.eventsCount - 1);
  });
});
