import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  extractOtpCode,
  seedCatalog,
  TestContext,
  uniqueEmail,
} from './create-test-app';

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Organisations (e2e)', () => {
  let ctx: TestContext;
  let categoryId: number;
  let platformIds: number[];

  const server = () => ctx.app.getHttpServer();

  const signIn = async (email: string): Promise<string> => {
    await request(server()).post('/api/v1/auth/send-otp').send({ email });
    const code = extractOtpCode(ctx.mails.at(-1)!);

    const response = await request(server())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code });

    return (response.body as { data: { token: string } }).data.token;
  };

  const createOrganisation = (
    token: string,
    overrides: Record<string, unknown> = {},
  ) =>
    request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Lagos Nights',
        slug: `lagos-nights-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        category_id: categoryId,
        about: 'We throw the best parties.',
        contact_email: 'hello@lagosnights.ng',
        website: 'https://lagosnights.ng',
        city: 'Lagos',
        socials: [{ platform_id: platformIds[0], handle: 'lagosnights' }],
        ...overrides,
      });

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedCatalog(ctx.prisma);

    const category = await ctx.prisma.organisationCategory.findFirstOrThrow({
      where: { slug: 'nightclub' },
    });
    categoryId = category.id;

    const platforms = await ctx.prisma.socialPlatform.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    platformIds = platforms.map((platform) => platform.id);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('lists organisation categories and social platforms', async () => {
    const token = await signIn(uniqueEmail('catalog'));

    const categories = await request(server())
      .get('/api/v1/organizer/organisation-categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const categoryItems = (categories.body as { data: Array<{ slug: string }> })
      .data;
    expect(categoryItems).toHaveLength(20);
    expect(categoryItems[0]).toMatchObject({
      slug: 'nightclub',
      name: 'Nightclub',
    });

    const platforms = await request(server())
      .get('/api/v1/organizer/social-platforms')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const platformItems = (
      platforms.body as {
        data: Array<{ slug: string; base_url: string | null }>;
      }
    ).data;
    expect(platformItems).toHaveLength(10);
    expect(platformItems[0]).toMatchObject({
      slug: 'instagram',
      base_url: 'https://instagram.com/',
    });
  });

  it('checks slug availability', async () => {
    const token = await signIn(uniqueEmail('slug'));

    const free = await request(server())
      .get('/api/v1/organizer/slug-available?slug=fresh-org-slug')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(free.body).toMatchObject({
      data: { slug: 'fresh-org-slug', available: true },
    });

    await request(server())
      .get('/api/v1/organizer/slug-available?slug=x')
      .set('Authorization', `Bearer ${token}`)
      .expect(422);
  });

  it('creates an organisation and makes the creator an organizer', async () => {
    const email = uniqueEmail('founder');
    const token = await signIn(email);

    const response = await createOrganisation(token).expect(201);

    expect(response.body).toMatchObject({
      status: 'success',
      message: 'Organisation created.',
      data: {
        name: 'Lagos Nights',
        about: 'We throw the best parties.',
        city: 'Lagos',
        events_count: 0,
        subscribers_count: 0,
        logo_url: null,
        category: { slug: 'nightclub', name: 'Nightclub' },
        socials: [
          {
            platform: 'instagram',
            name: 'Instagram',
            handle: 'lagosnights',
            url: 'https://instagram.com/lagosnights',
          },
        ],
      },
    });

    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const meBody = me.body as {
      data: { is_organizer: boolean; organisations: Array<{ name: string }> };
    };
    expect(meBody.data.is_organizer).toBe(true);
    expect(meBody.data.organisations).toHaveLength(1);
    expect(meBody.data.organisations[0].name).toBe('Lagos Nights');
  });

  it('rejects a taken slug', async () => {
    const token = await signIn(uniqueEmail('dupslug'));
    const slug = `taken-${Date.now().toString(36)}`;

    await createOrganisation(token, { slug }).expect(201);
    const response = await createOrganisation(token, { slug }).expect(422);

    expect(
      (response.body as { errors: Record<string, string[]> }).errors.slug,
    ).toEqual(['The slug has already been taken.']);
  });

  it('creates with multipart logo and bracket-notation socials', async () => {
    const token = await signIn(uniqueEmail('multipart'));
    const slug = `mp-${Date.now().toString(36)}`;

    const response = await request(server())
      .post('/api/v1/organizer/organisations')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Multipart Org')
      .field('slug', slug)
      .field('category_id', String(categoryId))
      .field('socials[0][platform_id]', String(platformIds[1]))
      .field('socials[0][handle]', 'mp_org')
      .attach('logo', PNG_PIXEL, {
        filename: 'logo.png',
        contentType: 'image/png',
      })
      .expect(201);

    const data = (
      response.body as {
        data: {
          logo_url: string;
          socials: Array<{ platform: string; handle: string }>;
        };
      }
    ).data;
    expect(data.logo_url).toContain('/storage/logos/');
    expect(data.socials).toEqual([
      expect.objectContaining({ platform: 'x', handle: 'mp_org' }),
    ]);
  });

  it('updates an organisation as owner and syncs socials', async () => {
    const token = await signIn(uniqueEmail('owner-upd'));
    const created = await createOrganisation(token).expect(201);
    const orgId = (created.body as { data: { id: string } }).data.id;

    const response = await request(server())
      .patch(`/api/v1/organizer/organisations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Lagos Nights Rebrand',
        about: null,
        socials: [
          { platform_id: platformIds[1], handle: 'rebrand' },
          { platform_id: platformIds[2], handle: 'rebrand_tk' },
        ],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      message: 'Organisation updated.',
      data: { name: 'Lagos Nights Rebrand', about: null },
    });

    const socials = (
      response.body as { data: { socials: Array<{ platform: string }> } }
    ).data.socials;
    expect(socials).toHaveLength(2);

    const cleared = await request(server())
      .patch(`/api/v1/organizer/organisations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ socials: null })
      .expect(200);

    expect(
      (cleared.body as { data: { socials: unknown[] } }).data.socials,
    ).toHaveLength(0);
  });

  it('hides management from non-owners as 404', async () => {
    const ownerToken = await signIn(uniqueEmail('the-owner'));
    const created = await createOrganisation(ownerToken).expect(201);
    const orgId = (created.body as { data: { id: string } }).data.id;

    const memberEmail = uniqueEmail('plain-member');
    const memberToken = await signIn(memberEmail);

    await request(server())
      .post(`/api/v1/organizer/organisations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail })
      .expect(201);

    await request(server())
      .patch(`/api/v1/organizer/organisations/${orgId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hijacked' })
      .expect(404);

    const outsiderToken = await signIn(uniqueEmail('outsider'));

    await request(server())
      .get(`/api/v1/organizer/organisations/${orgId}/members`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('manages members end to end', async () => {
    const ownerEmail = uniqueEmail('mgr-owner');
    const ownerToken = await signIn(ownerEmail);
    const created = await createOrganisation(ownerToken).expect(201);
    const orgId = (created.body as { data: { id: string } }).data.id;

    const unknown = await request(server())
      .post(`/api/v1/organizer/organisations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: uniqueEmail('ghost') })
      .expect(422);

    expect(unknown.body).toMatchObject({
      code: 'organisation_member_not_found',
    });

    const memberEmail = uniqueEmail('teammate');
    await signIn(memberEmail);

    const added = await request(server())
      .post(`/api/v1/organizer/organisations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail })
      .expect(201);

    expect(added.body).toMatchObject({
      message: 'Member added.',
      data: { email: memberEmail, role: 'member' },
    });

    const duplicate = await request(server())
      .post(`/api/v1/organizer/organisations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail })
      .expect(409);

    expect(duplicate.body).toMatchObject({
      code: 'organisation_member_already_exists',
    });

    const list = await request(server())
      .get(`/api/v1/organizer/organisations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const members = (
      list.body as { data: Array<{ email: string; role: string; id: string }> }
    ).data;
    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ email: ownerEmail, role: 'owner' });
    expect(members[1]).toMatchObject({ email: memberEmail, role: 'member' });

    const ownerId = members[0].id;
    const memberId = members[1].id;

    const cannotRemove = await request(server())
      .delete(`/api/v1/organizer/organisations/${orgId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(422);

    expect(cannotRemove.body).toMatchObject({ code: 'cannot_remove_owner' });

    const removed = await request(server())
      .delete(`/api/v1/organizer/organisations/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(removed.body).toMatchObject({ message: 'Member removed.' });

    const after = await request(server())
      .get(`/api/v1/organizer/organisations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((after.body as { data: unknown[] }).data).toHaveLength(1);
  });

  it('lists my organisations newest first', async () => {
    const token = await signIn(uniqueEmail('lister'));
    await createOrganisation(token, { name: 'First Org' }).expect(201);
    await createOrganisation(token, { name: 'Second Org' }).expect(201);

    const response = await request(server())
      .get('/api/v1/organizer/organisations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const names = (response.body as { data: Array<{ name: string }> }).data.map(
      (organisation) => organisation.name,
    );
    expect(names).toEqual(['Second Org', 'First Org']);
  });
});
