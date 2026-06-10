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

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Comments & reports (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let aliceToken: string;
  let aliceId: string;
  let bobToken: string;
  let eventId: string;

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const commentsPath = () => `/api/v1/attendee/events/${eventId}/comments`;

  const signIn = async (email: string): Promise<string> => {
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);
    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const onboard = async (token: string, username: string): Promise<string> => {
    const interests = await ctx.prisma.interest.findMany({ take: 1 });

    await request(server())
      .post('/api/v1/onboarding/profile')
      .set('Authorization', auth(token))
      .send({
        first_name: 'Comment',
        last_name: 'Tester',
        username,
        gender: 'male',
        date_of_birth: '1999-03-03',
        latitude: 6.5,
        longitude: 3.4,
        place_name: 'Lagos',
        interests: [interests[0].id],
      })
      .expect(200);

    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(token))
      .expect(200);

    return (me.body as { data: { id: string } }).data.id;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    const run = Date.now().toString(36);
    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();

    ownerToken = await signIn(uniqueEmail('cmt-owner'));
    await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({
        name: 'Comment Org',
        slug: `cmt-org-${run}`,
        category_id: category.id,
      })
      .expect(201);

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Comment Night ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;

    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'Comments under test.')
      .field('starts_at', '2027-10-01 20:00')
      .field('ends_at', '2027-10-02 02:00')
      .field('venue_name', 'Test Hall')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'flyer.png',
        contentType: 'image/png',
      })
      .expect(200);

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    aliceToken = await signIn(uniqueEmail('alice'));
    aliceId = await onboard(aliceToken, `alice_${run}`);
    bobToken = await signIn(uniqueEmail('bob'));
    await onboard(bobToken, `bob_${run}`);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates, replies, lists, and counts comments', async () => {
    const created = await request(server())
      .post(commentsPath())
      .set('Authorization', auth(aliceToken))
      .send({ body: 'First!', mentions: [aliceId] })
      .expect(200);

    expect(created.body).toMatchObject({
      data: {
        body: 'First!',
        parent_id: null,
        is_mine: true,
        mentions: [aliceId],
        author: { id: aliceId },
      },
    });

    const parentId = (created.body as { data: { id: string } }).data.id;

    const reply = await request(server())
      .post(commentsPath())
      .set('Authorization', auth(bobToken))
      .send({ body: 'Welcome!', parent_id: parentId })
      .expect(200);

    expect(reply.body).toMatchObject({
      data: { parent_id: parentId, is_mine: true },
    });

    const event = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(event.commentsCount).toBe(2);

    const parent = await ctx.prisma.eventComment.findUniqueOrThrow({
      where: { id: parentId },
    });
    expect(parent.repliesCount).toBe(1);

    const list = await request(server())
      .get(commentsPath())
      .set('Authorization', auth(aliceToken))
      .expect(200);

    const items = (
      list.body as {
        data: { items: Array<{ id: string; replies_count: number }> };
      }
    ).data.items;
    expect(items.some((item) => item.id === parentId)).toBe(true);
    expect(items.find((item) => item.id === parentId)?.replies_count).toBe(1);

    const replies = await request(server())
      .get(`${commentsPath()}/${parentId}/replies`)
      .set('Authorization', auth(aliceToken))
      .expect(200);

    expect(
      (replies.body as { data: { items: unknown[] } }).data.items,
    ).toHaveLength(1);

    await request(server())
      .post(commentsPath())
      .set('Authorization', auth(aliceToken))
      .send({
        parent_id: (reply.body as { data: { id: string } }).data.id,
        body: 'nested',
      })
      .expect(422);
  });

  it('requires a body or a gif', async () => {
    const response = await request(server())
      .post(commentsPath())
      .set('Authorization', auth(aliceToken))
      .send({})
      .expect(422);

    expect(
      (response.body as { errors: Record<string, string[]> }).errors.body,
    ).toEqual(['Add a message or a GIF.']);
  });

  it('handles likes idempotently', async () => {
    const created = await request(server())
      .post(commentsPath())
      .set('Authorization', auth(aliceToken))
      .send({ body: 'Like me' })
      .expect(200);
    const commentId = (created.body as { data: { id: string } }).data.id;

    const liked = await request(server())
      .post(`${commentsPath()}/${commentId}/like`)
      .set('Authorization', auth(bobToken))
      .expect(200);

    expect(liked.body).toMatchObject({
      data: { is_liked: true, likes_count: 1 },
    });

    await request(server())
      .post(`${commentsPath()}/${commentId}/like`)
      .set('Authorization', auth(bobToken))
      .expect(200);

    const stored = await ctx.prisma.eventComment.findUniqueOrThrow({
      where: { id: commentId },
    });
    expect(stored.likesCount).toBe(1);

    const unliked = await request(server())
      .delete(`${commentsPath()}/${commentId}/like`)
      .set('Authorization', auth(bobToken))
      .expect(200);

    expect(unliked.body).toMatchObject({
      data: { is_liked: false, likes_count: 0 },
    });
  });

  it('only allows deleting your own comments and fixes counters', async () => {
    const created = await request(server())
      .post(commentsPath())
      .set('Authorization', auth(aliceToken))
      .send({ body: 'Delete me' })
      .expect(200);
    const commentId = (created.body as { data: { id: string } }).data.id;

    const forbidden = await request(server())
      .delete(`${commentsPath()}/${commentId}`)
      .set('Authorization', auth(bobToken))
      .expect(403);

    expect(forbidden.body).toMatchObject({
      message: 'You can only delete your own comments.',
    });

    const before = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });

    await request(server())
      .delete(`${commentsPath()}/${commentId}`)
      .set('Authorization', auth(aliceToken))
      .expect(200);

    const after = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(after.commentsCount).toBe(before.commentsCount - 1);
  });

  it('lets organizers flag comments, hiding them from attendees', async () => {
    const created = await request(server())
      .post(commentsPath())
      .set('Authorization', auth(bobToken))
      .send({ body: 'Spammy thing' })
      .expect(200);
    const commentId = (created.body as { data: { id: string } }).data.id;

    const flagged = await request(server())
      .post(`/api/v1/organizer/events/${eventId}/comments/${commentId}/flag`)
      .set('Authorization', auth(ownerToken))
      .send({ reason: 'spam' })
      .expect(200);

    expect(flagged.body).toMatchObject({
      data: { is_flagged_by_me: true, flags_count: 1 },
    });

    const attendeeList = await request(server())
      .get(commentsPath())
      .set('Authorization', auth(aliceToken))
      .expect(200);
    expect(
      (
        attendeeList.body as { data: { items: Array<{ id: string }> } }
      ).data.items.some((item) => item.id === commentId),
    ).toBe(false);

    const flaggedOnly = await request(server())
      .get(`/api/v1/organizer/events/${eventId}/comments?flagged_only=true`)
      .set('Authorization', auth(ownerToken))
      .expect(200);
    expect(
      (
        flaggedOnly.body as { data: { items: Array<{ id: string }> } }
      ).data.items.some((item) => item.id === commentId),
    ).toBe(true);

    const unflagged = await request(server())
      .delete(`/api/v1/organizer/events/${eventId}/comments/${commentId}/flag`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    expect(unflagged.body).toMatchObject({
      data: { is_flagged_by_me: false, flags_count: 0 },
    });
  });

  it('lists report reasons scoped to the target type', async () => {
    const eventReasons = await request(server())
      .get('/api/v1/report-reasons?target_type=event')
      .set('Authorization', auth(aliceToken))
      .expect(200);

    const slugs = (
      eventReasons.body as { data: Array<{ slug: string }> }
    ).data.map((reason) => reason.slug);

    expect(slugs).toContain('spam');
    expect(slugs).toContain('fake_event');
    expect(slugs).not.toContain('underage_user');
  });

  it('enforces the report lifecycle rules', async () => {
    await ctx.prisma.systemConfig.update({
      where: { key: 'reports.cooldown_seconds' },
      data: { value: { v: 0 } },
    });

    const reason = await ctx.prisma.reportReason.findFirstOrThrow({
      where: { slug: 'spam' },
    });
    const otherReason = await ctx.prisma.reportReason.findFirstOrThrow({
      where: { slug: 'other' },
    });

    const created = await request(server())
      .post('/api/v1/reports')
      .set('Authorization', auth(aliceToken))
      .send({
        target_type: 'event',
        target_id: eventId,
        report_reason_id: reason.id,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      data: { target_type: 'event', target_id: eventId, status: 'open' },
    });

    const duplicate = await request(server())
      .post('/api/v1/reports')
      .set('Authorization', auth(aliceToken))
      .send({
        target_type: 'event',
        target_id: eventId,
        report_reason_id: reason.id,
      })
      .expect(409);
    expect(duplicate.body).toMatchObject({ code: 'report_already_exists' });

    const detailsMissing = await request(server())
      .post('/api/v1/reports')
      .set('Authorization', auth(bobToken))
      .send({
        target_type: 'user',
        target_id: aliceId,
        report_reason_id: otherReason.id,
      })
      .expect(422);
    expect(detailsMissing.body).toMatchObject({
      code: 'report_details_required',
    });

    const selfReport = await request(server())
      .post('/api/v1/reports')
      .set('Authorization', auth(ownerToken))
      .send({
        target_type: 'event',
        target_id: eventId,
        report_reason_id: reason.id,
      })
      .expect(422);
    expect(selfReport.body).toMatchObject({ code: 'report_self_target' });

    const wrongScope = await request(server())
      .post('/api/v1/reports')
      .set('Authorization', auth(bobToken))
      .send({
        target_type: 'event',
        target_id: eventId,
        report_reason_id: (
          await ctx.prisma.reportReason.findFirstOrThrow({
            where: { slug: 'underage_user' },
          })
        ).id,
      })
      .expect(422);
    expect(wrongScope.body).toMatchObject({ code: 'report_invalid_reason' });

    await ctx.prisma.systemConfig.update({
      where: { key: 'reports.cooldown_seconds' },
      data: { value: { v: 30 } },
    });

    const throttled = await request(server())
      .post('/api/v1/reports')
      .set('Authorization', auth(aliceToken))
      .send({
        target_type: 'user',
        target_id: aliceId,
        report_reason_id: reason.id,
      })
      .expect(429);
    expect(throttled.body).toMatchObject({ code: 'report_cooldown_active' });
  });

  it('lists a user public comments', async () => {
    const response = await request(server())
      .get(`/api/v1/users/${aliceId}/comments`)
      .set('Authorization', auth(bobToken))
      .expect(200);

    const items = (
      response.body as {
        data: { items: Array<{ body: string; event: { id: string } }> };
      }
    ).data.items;

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].event.id).toBe(eventId);
  });

  it('returns empty gif results without external calls when no key is set', async () => {
    const response = await request(server())
      .get('/api/v1/giphy/search?query=party')
      .set('Authorization', auth(aliceToken))
      .expect(200);

    expect(response.body).toMatchObject({
      data: { items: [], total: 0 },
    });

    await request(server())
      .get('/api/v1/places/search?query=lekki')
      .set('Authorization', auth(aliceToken))
      .expect(200);

    await request(server())
      .get('/api/v1/places/some-place-id')
      .set('Authorization', auth(aliceToken))
      .expect(404);
  });
});
