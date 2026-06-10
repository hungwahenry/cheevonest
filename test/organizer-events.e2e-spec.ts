import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  extractOtpCode,
  seedCatalog,
  seedInterests,
  TestContext,
  uniqueEmail,
} from './create-test-app';

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Organizer events (e2e)', () => {
  let ctx: TestContext;
  let ownerToken: string;
  let categoryId: number;

  const server = () => ctx.app.getHttpServer();

  const signIn = async (email: string): Promise<string> => {
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);

    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const createOrganisation = async (token: string): Promise<string> => {
    const response = await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Events Org',
        slug: `events-org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        category_id: categoryId,
      })
      .expect(201);

    return (response.body as { data: { id: string } }).data.id;
  };

  const createEvent = async (
    token: string,
    payload: Record<string, unknown> = {},
  ) => {
    const response = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lagos Block Party', ...payload })
      .expect(201);

    return (response.body as { data: { id: string; slug: string } }).data;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedCatalog(ctx.prisma);
    await seedInterests(ctx.prisma);

    const category = await ctx.prisma.organisationCategory.findFirstOrThrow();
    categoryId = category.id;

    ownerToken = await signIn(uniqueEmail('event-owner'));
    await createOrganisation(ownerToken);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates a draft from just a title with a web_url and unique slug', async () => {
    const runId = Date.now().toString(36);
    const title = `Slug Clash ${runId}`;

    const first = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title })
      .expect(201);

    expect(first.body).toMatchObject({
      message: 'Event created.',
      data: {
        title,
        slug: `slug-clash-${runId}`,
        web_url: `https://cheevo.events/events/slug-clash-${runId}`,
        status: 'draft',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        tickets_count: 0,
        interests: [],
      },
    });

    const second = await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title })
      .expect(201);

    expect((second.body as { data: { slug: string } }).data.slug).toBe(
      `slug-clash-${runId}-2`,
    );
  });

  it('requires an organisation to create events', async () => {
    const stranger = await signIn(uniqueEmail('no-org'));

    await request(server())
      .post('/api/v1/organizer/events')
      .set('Authorization', `Bearer ${stranger}`)
      .send({ title: 'Nope' })
      .expect(403);
  });

  it('converts wall-clock dates from the event timezone to UTC', async () => {
    const event = await createEvent(ownerToken, {
      starts_at: '2027-01-15 20:00',
      ends_at: '2027-01-16 02:00',
    });

    const stored = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(stored.startsAt?.toISOString()).toBe('2027-01-15T19:00:00.000Z');
    expect(stored.endsAt?.toISOString()).toBe('2027-01-16T01:00:00.000Z');
  });

  it('updates fields, syncs interests by slug, and rejects bad chronology', async () => {
    const event = await createEvent(ownerToken);

    const updated = await request(server())
      .patch(`/api/v1/organizer/events/${event.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        description: 'The biggest party in Lagos.',
        venue_name: 'Muri Okunola Park',
        interests: ['afrobeats', 'parties'],
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      message: 'Event updated.',
      data: {
        description: 'The biggest party in Lagos.',
        venue_name: 'Muri Okunola Park',
        interests: [
          { slug: 'afrobeats', name: 'Afrobeats' },
          { slug: 'parties', name: 'Parties' },
        ],
      },
    });

    await request(server())
      .patch(`/api/v1/organizer/events/${event.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ starts_at: '2027-05-02 20:00', ends_at: '2027-05-01 20:00' })
      .expect(422);

    await request(server())
      .patch(`/api/v1/organizer/events/${event.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ interests: ['not-a-real-interest'] })
      .expect(422);
  });

  it('forbids non-members from touching the event', async () => {
    const event = await createEvent(ownerToken);
    const outsider = await signIn(uniqueEmail('outsider'));
    await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', `Bearer ${outsider}`)
      .send({
        name: 'Other Org',
        slug: `other-${Date.now().toString(36)}`,
        category_id: categoryId,
      })
      .expect(201);

    const response = await request(server())
      .patch(`/api/v1/organizer/events/${event.id}`)
      .set('Authorization', `Bearer ${outsider}`)
      .send({ title: 'Hijacked' })
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'forbidden',
      message: 'This action is unauthorized.',
    });
  });

  it('manages tickets and keeps event aggregates in sync', async () => {
    const event = await createEvent(ownerToken);

    const vip = await request(server())
      .post(`/api/v1/organizer/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'VIP',
        gross_price: 500000,
        quantity: 50,
        status: 'on_sale',
      })
      .expect(201);

    expect(vip.body).toMatchObject({
      message: 'Ticket added.',
      data: { name: 'VIP', gross_price: 500000, sold_count: 0, sort_order: 1 },
    });

    await request(server())
      .post(`/api/v1/organizer/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Regular', gross_price: 100000 })
      .expect(201);

    let stored = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(stored.ticketsCount).toBe(2);
    expect(stored.ticketsMinPrice).toBe(100000);
    expect(stored.ticketsMaxPrice).toBe(500000);

    const vipId = (vip.body as { data: { id: string } }).data.id;

    await request(server())
      .patch(`/api/v1/organizer/events/${event.id}/tickets/${vipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ gross_price: 750000 })
      .expect(200);

    stored = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(stored.ticketsMaxPrice).toBe(750000);

    await request(server())
      .delete(`/api/v1/organizer/events/${event.id}/tickets/${vipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    stored = await ctx.prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(stored.ticketsCount).toBe(1);
    expect(stored.ticketsMaxPrice).toBe(100000);

    await request(server())
      .post(`/api/v1/organizer/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Broken', gross_price: 1000, quantity: 0 })
      .expect(422);
  });

  it('rejects ticket windows outside the event window', async () => {
    const event = await createEvent(ownerToken, {
      starts_at: '2027-03-01 20:00',
      ends_at: '2027-03-02 02:00',
    });

    const response = await request(server())
      .post(`/api/v1/organizer/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Late',
        gross_price: 1000,
        sales_starts_at: '2027-03-10 10:00',
      })
      .expect(422);

    expect(
      (response.body as { errors: Record<string, string[]> }).errors
        .sales_starts_at,
    ).toEqual(['Sales must start before the event ends.']);
  });

  it('manages the image gallery', async () => {
    const event = await createEvent(ownerToken);

    const added = await request(server())
      .post(`/api/v1/organizer/events/${event.id}/images`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('image', PNG_PIXEL, {
        filename: 'gallery.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(added.body).toMatchObject({ message: 'Image added.' });
    const imageId = (added.body as { data: { id: string; url: string } }).data;
    expect(imageId.url).toContain('/storage/event-images/');

    const second = await request(server())
      .post(`/api/v1/organizer/events/${event.id}/images`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('image', PNG_PIXEL, {
        filename: 'gallery2.png',
        contentType: 'image/png',
      })
      .expect(201);
    const secondId = (second.body as { data: { id: string } }).data.id;

    const reordered = await request(server())
      .patch(`/api/v1/organizer/events/${event.id}/images/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ids: [secondId, imageId.id] })
      .expect(200);

    const images = (
      reordered.body as { data: { images: Array<{ id: string }> } }
    ).data.images;
    expect(images[0].id).toBe(secondId);

    await request(server())
      .delete(`/api/v1/organizer/events/${event.id}/images/${secondId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('manages features', async () => {
    const event = await createEvent(ownerToken);

    const created = await request(server())
      .post(`/api/v1/organizer/events/${event.id}/features`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Headline DJ',
        description: 'Special guest set.',
        link: 'https://example.com/dj',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      message: 'Feature added.',
      data: { title: 'Headline DJ', sort_order: 1, image_url: null },
    });

    const featureId = (created.body as { data: { id: string } }).data.id;

    await request(server())
      .patch(`/api/v1/organizer/events/${event.id}/features/${featureId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Surprise Guest' })
      .expect(200);

    await request(server())
      .delete(`/api/v1/organizer/events/${event.id}/features/${featureId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('locks ended events against changes', async () => {
    const event = await createEvent(ownerToken);

    await ctx.prisma.event.update({
      where: { id: event.id },
      data: { status: 'past' },
    });

    const response = await request(server())
      .patch(`/api/v1/organizer/events/${event.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Too late' })
      .expect(422);

    expect(response.body).toMatchObject({ code: 'event_ended' });

    await request(server())
      .post(`/api/v1/organizer/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Late', gross_price: 1000 })
      .expect(422);
  });

  it('enforces publish requirements then publishes', async () => {
    const event = await createEvent(ownerToken);

    const blocked = await request(server())
      .post(`/api/v1/organizer/events/${event.id}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(422);

    const errors = (blocked.body as { errors: Record<string, string[]> })
      .errors;
    expect(errors.description).toBeDefined();
    expect(errors.starts_at).toBeDefined();
    expect(errors.ends_at).toBeDefined();
    expect(errors.location).toBeDefined();
    expect(errors.flyer).toBeDefined();
    expect(errors.interests).toBeDefined();

    await request(server())
      .patch(`/api/v1/organizer/events/${event.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('description', 'A night to remember.')
      .field('starts_at', '2027-06-01 20:00')
      .field('ends_at', '2027-06-02 02:00')
      .field('venue_name', 'The Dome')
      .field('interests[]', 'afrobeats')
      .attach('flyer', PNG_PIXEL, {
        filename: 'flyer.png',
        contentType: 'image/png',
      })
      .expect(200);

    const published = await request(server())
      .post(`/api/v1/organizer/events/${event.id}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(published.body).toMatchObject({
      message: 'Event published.',
      data: { status: 'published', flyer_type: 'image' },
    });
    expect(
      (published.body as { data: { published_at: string | null } }).data
        .published_at,
    ).not.toBeNull();
  });

  it('duplicates an event back to a fresh draft', async () => {
    const event = await createEvent(ownerToken, {
      description: 'Original description',
      starts_at: '2027-07-01 20:00',
      ends_at: '2027-07-02 02:00',
    });

    await request(server())
      .post(`/api/v1/organizer/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'GA', gross_price: 200000, quantity: 100 })
      .expect(201);

    await ctx.prisma.eventTicket.updateMany({
      where: { eventId: event.id },
      data: { soldCount: 42 },
    });
    await ctx.prisma.event.update({
      where: { id: event.id },
      data: { ticketsSold: 42, revenueMinor: 8400000n },
    });

    const orgBefore = await ctx.prisma.organisation.findFirstOrThrow({
      where: { events: { some: { id: event.id } } },
    });

    const duplicated = await request(server())
      .post(`/api/v1/organizer/events/${event.id}/duplicate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(duplicated.body).toMatchObject({
      message: 'Event duplicated.',
      data: {
        title: `Copy of ${event ? 'Lagos Block Party' : ''}`,
        status: 'draft',
        starts_at: null,
        ends_at: null,
        flyer_url: null,
        tickets_sold: 0,
        revenue_minor: 0,
        description: 'Original description',
      },
    });

    const cloneTickets = (
      duplicated.body as {
        data: { tickets: Array<{ name: string; sold_count: number }> };
      }
    ).data.tickets;
    expect(cloneTickets).toHaveLength(1);
    expect(cloneTickets[0]).toMatchObject({ name: 'GA', sold_count: 0 });

    const orgAfter = await ctx.prisma.organisation.findUniqueOrThrow({
      where: { id: orgBefore.id },
    });
    expect(orgAfter.eventsCount).toBe(orgBefore.eventsCount + 1);
  });

  it('deletes an event and decrements the organisation counter', async () => {
    const event = await createEvent(ownerToken);

    const orgBefore = await ctx.prisma.organisation.findFirstOrThrow({
      where: { events: { some: { id: event.id } } },
    });

    await request(server())
      .delete(`/api/v1/organizer/events/${event.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(server())
      .get(`/api/v1/organizer/events/${event.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);

    const orgAfter = await ctx.prisma.organisation.findUniqueOrThrow({
      where: { id: orgBefore.id },
    });
    expect(orgAfter.eventsCount).toBe(orgBefore.eventsCount - 1);
  });

  it('lists events with pagination and filters', async () => {
    const response = await request(server())
      .get('/api/v1/organizer/events?per_page=5&status=draft&q=lagos')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const body = response.body as {
      data: {
        items: Array<{ status: string; title: string }>;
        page: number;
        per_page: number;
        total: number;
      };
    };

    expect(body.data.page).toBe(1);
    expect(body.data.per_page).toBe(5);
    expect(body.data.total).toBeGreaterThan(0);
    expect(body.data.items.length).toBeLessThanOrEqual(5);

    for (const item of body.data.items) {
      expect(item.status).toBe('draft');
      expect(item.title.toLowerCase()).toContain('lagos');
    }
  });
});
