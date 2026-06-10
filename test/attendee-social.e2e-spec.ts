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

describe('Attendee social (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let attendeeToken: string;
  let attendeeId: string;
  let orgId: string;
  let orgSlug: string;
  let eventId: string;
  let eventSlug: string;
  let interestIds: number[];
  let runId: string;

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

  const onboard = async (token: string, username: string): Promise<void> => {
    await request(server())
      .post('/api/v1/onboarding/profile')
      .set('Authorization', auth(token))
      .send({
        first_name: 'Test',
        last_name: 'User',
        username,
        gender: 'female',
        date_of_birth: '2000-01-15',
        latitude: 6.5244,
        longitude: 3.3792,
        place_name: 'Lagos Island',
        city: 'Lagos',
        interests: [interestIds[0]],
      })
      .expect(200);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);
    await seedPlatform(ctx.prisma);

    const interests = await ctx.prisma.interest.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    interestIds = interests.map((interest) => interest.id);

    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();
    const run = Date.now().toString(36);
    runId = run;

    ownerToken = await signIn(uniqueEmail('social-owner'));
    orgSlug = `social-org-${run}`;
    const org = await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', auth(ownerToken))
      .send({ name: 'Social Org', slug: orgSlug, category_id: category.id })
      .expect(201);
    orgId = (org.body as { data: { id: string } }).data.id;

    const event = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', auth(ownerToken))
      .send({ title: `Social Fest ${run}` })
      .expect(201);
    eventId = (event.body as { data: { id: string } }).data.id;
    eventSlug = (event.body as { data: { slug: string } }).data.slug;

    await request(server())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Authorization', auth(ownerToken))
      .field('description', 'The social event of the year.')
      .field('starts_at', '2027-09-01 20:00')
      .field('ends_at', '2027-09-02 02:00')
      .field('venue_name', 'Social Dome')
      .field('city', 'Lagos')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'flyer.png',
        contentType: 'image/png',
      })
      .expect(200);

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/tickets`)
      .set('Authorization', auth(ownerToken))
      .send({ name: 'GA', gross_price: 100000, status: 'on_sale' })
      .expect(201);

    await request(server())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    attendeeToken = await signIn(uniqueEmail('social-attendee'));
    await onboard(attendeeToken, `att_${run}`);
    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', auth(attendeeToken))
      .expect(200);
    attendeeId = (me.body as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('serves the public event page without auth', async () => {
    const response = await request(server())
      .get(`/api/v1/events/${eventSlug}`)
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        slug: eventSlug,
        status: 'published',
        organisation: { name: 'Social Org', slug: orgSlug },
        tickets: [{ name: 'GA', gross_price: 100000 }],
      },
    });
    expect(
      (response.body as { data: { tickets: Array<Record<string, unknown>> } })
        .data.tickets[0].quantity,
    ).toBeUndefined();
  });

  it('shows attendee event detail with viewer flags', async () => {
    const response = await request(server())
      .get(`/api/v1/attendee/events/${eventSlug}`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    expect(response.body).toMatchObject({
      data: {
        slug: eventSlug,
        is_subscribed: false,
        is_rsvped: false,
        is_muted: false,
        interest_overlap: 1,
        organisation: { slug: orgSlug },
      },
    });
  });

  it('handles the rsvp lifecycle idempotently', async () => {
    const rsvp = await request(server())
      .post(`/api/v1/attendee/events/${eventId}/rsvp`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    expect(rsvp.body).toMatchObject({
      message: "You're going.",
      data: { is_rsvped: true, rsvps_count: 1 },
    });

    await request(server())
      .post(`/api/v1/attendee/events/${eventId}/rsvp`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    const stored = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(stored.rsvpsCount).toBe(1);

    const unrsvp = await request(server())
      .delete(`/api/v1/attendee/events/${eventId}/rsvp`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    expect(unrsvp.body).toMatchObject({
      message: 'No longer going.',
      data: { is_rsvped: false, rsvps_count: 0 },
    });
  });

  it('handles subscriptions with counters and public org pages', async () => {
    const subscribed = await request(server())
      .post(`/api/v1/attendee/organisations/${orgId}/subscribe`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    expect(subscribed.body).toMatchObject({
      message: 'Subscribed.',
      data: { subscribers_count: 1 },
    });

    await request(server())
      .post(`/api/v1/attendee/organisations/${orgId}/subscribe`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    const orgPage = await request(server())
      .get(`/api/v1/attendee/orgs/${orgSlug}`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    expect(orgPage.body).toMatchObject({
      data: { is_subscribed: true, is_blocked: false, subscribers_count: 1 },
    });

    const upcoming = await request(server())
      .get(`/api/v1/attendee/orgs/${orgSlug}/upcoming-events`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    const upcomingItems = (
      upcoming.body as { data: { items: Array<{ slug: string }> } }
    ).data.items;
    expect(upcomingItems.some((item) => item.slug === eventSlug)).toBe(true);

    const subscribers = await request(server())
      .get(`/api/v1/attendee/orgs/${orgSlug}/subscribers`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    expect(subscribers.body).toMatchObject({ data: { count: 1 } });
    expect(
      (subscribers.body as { data: { sample: unknown[] } }).data.sample,
    ).toHaveLength(1);
  });

  it('ranks the feed and respects exclusions', async () => {
    const feed = await request(server())
      .get('/api/v1/attendee/feed')
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    const items = (
      feed.body as {
        data: {
          items: Array<{
            slug: string;
            interest_overlap: number;
            is_subscribed: boolean;
            organisation: { slug: string };
          }>;
          total: number;
        };
      }
    ).data.items;

    const entry = items.find((item) => item.slug === eventSlug);
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      interest_overlap: 1,
      is_subscribed: true,
      organisation: { slug: orgSlug },
    });

    const ownerFeed = await request(server())
      .get('/api/v1/attendee/feed')
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const ownerItems = (
      ownerFeed.body as { data: { items: Array<{ slug: string }> } }
    ).data.items;
    expect(ownerItems.some((item) => item.slug === eventSlug)).toBe(false);
  });

  it('searches events, organisations, and users', async () => {
    const all = await request(server())
      .get(`/api/v1/search?q=${runId}`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    const groups = (
      all.body as {
        data: {
          events: Array<{ slug: string }>;
          organisations: Array<{ slug: string }>;
          users: unknown[];
        };
      }
    ).data;

    expect(groups.events.some((event) => event.slug === eventSlug)).toBe(true);
    expect(
      groups.organisations.some(
        (organisation) => organisation.slug === orgSlug,
      ),
    ).toBe(true);

    const userHits = await request(server())
      .get(`/api/v1/search/user?q=${runId}`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    const userItems = (
      userHits.body as { data: { items: Array<{ id: string }> } }
    ).data.items;
    expect(userItems.some((item) => item.id === attendeeId)).toBe(true);

    await request(server())
      .get('/api/v1/search/bogus?q=social')
      .set('Authorization', auth(attendeeToken))
      .expect(404);

    await request(server())
      .get('/api/v1/search?q=a')
      .set('Authorization', auth(attendeeToken))
      .expect(422);
  });

  it('blocks an organisation: unsubscribes, hides from feed and search', async () => {
    const blocked = await request(server())
      .post('/api/v1/attendee/blocks')
      .set('Authorization', auth(attendeeToken))
      .send({ target_type: 'organisation', target_id: orgId })
      .expect(201);

    expect(blocked.body).toMatchObject({ message: 'Blocked.' });

    const org = await ctx.prisma.organisation.findUniqueOrThrow({
      where: { id: orgId },
    });
    expect(org.subscribersCount).toBe(0);

    const feed = await request(server())
      .get('/api/v1/attendee/feed')
      .set('Authorization', auth(attendeeToken))
      .expect(200);
    expect(
      (
        feed.body as { data: { items: Array<{ slug: string }> } }
      ).data.items.some((item) => item.slug === eventSlug),
    ).toBe(false);

    const search = await request(server())
      .get(`/api/v1/search?q=${runId}`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);
    expect(
      (
        search.body as { data: { organisations: Array<{ slug: string }> } }
      ).data.organisations.some((item) => item.slug === orgSlug),
    ).toBe(false);

    const list = await request(server())
      .get('/api/v1/attendee/blocks/organisations')
      .set('Authorization', auth(attendeeToken))
      .expect(200);
    expect(
      (list.body as { data: { items: Array<{ id: string }> } }).data.items[0]
        .id,
    ).toBe(orgId);

    await request(server())
      .delete(`/api/v1/attendee/blocks/organisation/${orgId}`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    const searchAfter = await request(server())
      .get(`/api/v1/search?q=${runId}`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);
    expect(
      (
        searchAfter.body as { data: { organisations: Array<{ slug: string }> } }
      ).data.organisations.some((item) => item.slug === orgSlug),
    ).toBe(true);
  });

  it('guards block edge cases', async () => {
    const self = await request(server())
      .post('/api/v1/attendee/blocks')
      .set('Authorization', auth(attendeeToken))
      .send({ target_type: 'user', target_id: attendeeId })
      .expect(422);
    expect(self.body).toMatchObject({ code: 'cannot_block_yourself' });

    const missing = await request(server())
      .post('/api/v1/attendee/blocks')
      .set('Authorization', auth(attendeeToken))
      .send({ target_type: 'user', target_id: '01JXXXXXXXXXXXXXXXXXXXXXXX' })
      .expect(404);
    expect(missing.body).toMatchObject({ code: 'block_target_not_found' });
  });

  it('serves public user pages for onboarded users only', async () => {
    const show = await request(server())
      .get(`/api/v1/users/${attendeeId}`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    expect(show.body).toMatchObject({
      data: { id: attendeeId, is_blocked: false },
    });
    expect(
      (show.body as { data: { username: string } }).data.username,
    ).toContain('att_');

    const interests = await request(server())
      .get(`/api/v1/users/${attendeeId}/interests`)
      .set('Authorization', auth(ownerToken))
      .expect(200);
    expect((interests.body as { data: unknown[] }).data).toHaveLength(1);

    const notOnboarded = await ctx.prisma.user.findFirstOrThrow({
      where: { profile: { completedAt: null } },
    });

    await request(server())
      .get(`/api/v1/users/${notOnboarded.id}`)
      .set('Authorization', auth(ownerToken))
      .expect(404);
  });

  it('lists attended events from past rsvps', async () => {
    await request(server())
      .post(`/api/v1/attendee/events/${eventId}/rsvp`)
      .set('Authorization', auth(attendeeToken))
      .expect(200);

    await ctx.prisma.event.update({
      where: { id: eventId },
      data: { status: 'past' },
    });

    const attended = await request(server())
      .get(`/api/v1/users/${attendeeId}/attended-events`)
      .set('Authorization', auth(ownerToken))
      .expect(200);

    const items = (
      attended.body as { data: { items: Array<{ slug: string }> } }
    ).data.items;
    expect(items.some((item) => item.slug === eventSlug)).toBe(true);

    await ctx.prisma.event.update({
      where: { id: eventId },
      data: { status: 'published' },
    });
  });
});
