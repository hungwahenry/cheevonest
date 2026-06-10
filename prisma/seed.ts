import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { INTERESTS } from './seed-data';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  for (const [index, interest] of INTERESTS.entries()) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: { name: interest.name, sortOrder: index, isActive: true },
      create: {
        slug: interest.slug,
        name: interest.name,
        sortOrder: index,
        isActive: true,
      },
    });
  }

  console.log(`Seeded ${INTERESTS.length} interests.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
