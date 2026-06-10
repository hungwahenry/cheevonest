import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  seedFeatureFlags,
  seedInterests,
  seedOrganisationCatalog,
  seedSystemConfigs,
} from './seeders';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  await seedInterests(prisma);
  await seedSystemConfigs(prisma);
  await seedFeatureFlags(prisma);
  await seedOrganisationCatalog(prisma);

  console.log(
    'Seeded interests, system configs, feature flags, and organisation catalog.',
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
