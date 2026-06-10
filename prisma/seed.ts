import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedFeatureFlags, seedInterests, seedSystemConfigs } from './seeders';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  await seedInterests(prisma);
  await seedSystemConfigs(prisma);
  await seedFeatureFlags(prisma);

  console.log('Seeded interests, system configs, and feature flags.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
