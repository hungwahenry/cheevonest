import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ulid } from 'ulid';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();

  if (!email) {
    console.error('ADMIN_BOOTSTRAP_EMAIL is not set — nothing to do.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      options: '-c TimeZone=UTC',
      connectionString: process.env.DATABASE_URL,
    }),
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'admin' },
    create: {
      id: ulid(),
      email,
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Granted admin role to ${user.email} (${user.id}).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
