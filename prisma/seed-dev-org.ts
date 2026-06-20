import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ulid } from 'ulid';
import { PrismaClient } from '../src/generated/prisma/client';
import { upsertSearchDocument } from '../src/generated/prisma/sql';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      options: '-c TimeZone=UTC',
      connectionString: process.env.DATABASE_URL,
    }),
  });

  const category = await prisma.organisationCategory.findFirst({
    orderBy: { sortOrder: 'asc' },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@nine.test' },
    update: { role: 'organiser' },
    create: {
      id: ulid(),
      email: 'owner@nine.test',
      role: 'organiser',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          id: ulid(),
          firstName: 'Nine',
          lastName: 'Team',
          username: 'nine',
          city: 'Lagos',
          referralCode: ulid().slice(-10).toLowerCase(),
          completedAt: new Date(),
        },
      },
    },
  });

  const organisation = await prisma.organisation.upsert({
    where: { slug: 'nine' },
    update: {},
    create: {
      id: ulid(),
      name: 'Nine',
      slug: 'nine',
      categoryId: category?.id ?? null,
      about: 'Lagos nightlife and live events. Detty everything.',
      contactEmail: 'hello@nine.test',
      city: 'Lagos',
    },
  });

  await prisma.organisationMember.upsert({
    where: {
      organisationId_userId: {
        organisationId: organisation.id,
        userId: owner.id,
      },
    },
    update: { role: 'owner' },
    create: {
      organisationId: organisation.id,
      userId: owner.id,
      role: 'owner',
    },
  });

  await prisma.payoutAccount.upsert({
    where: { organisationId: organisation.id },
    update: {},
    create: {
      id: ulid(),
      organisationId: organisation.id,
      bankCode: '058',
      bankName: 'Guaranty Trust Bank',
      accountNumber: '0123456789',
      accountName: 'Nine Entertainment Ltd',
      currency: 'NGN',
      provider: 'paystack',
      verifiedAt: new Date(),
    },
  });

  await prisma.$queryRawTyped(
    upsertSearchDocument(
      'organisation',
      organisation.id,
      organisation.name,
      organisation.about ?? '',
      organisation.city ?? '',
    ),
  );

  console.log(
    `Bootstrapped organisation @${organisation.slug} (${organisation.id}) owned by ${owner.email}.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
