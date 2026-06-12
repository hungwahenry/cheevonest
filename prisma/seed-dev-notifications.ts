import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ulid } from 'ulid';
import { PrismaClient } from '../src/generated/prisma/client';

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      options: '-c TimeZone=UTC',
      connectionString: process.env.DATABASE_URL,
    }),
  });

  const organisation = await prisma.organisation.findUnique({ where: { slug: 'nine' } });
  if (!organisation) {
    throw new Error("Organisation with slug 'nine' not found.");
  }

  const owner = await prisma.organisationMember.findFirst({
    where: { organisationId: organisation.id, role: 'owner' },
  });
  if (!owner) {
    throw new Error('Owner member not found.');
  }

  const events = await prisma.event.findMany({
    where: { organisationId: organisation.id, status: { in: ['published', 'past'] } },
    orderBy: { startsAt: 'desc' },
  });
  if (events.length === 0) {
    throw new Error('No published events to attach notifications to.');
  }

  const existing = await prisma.notification.count({ where: { userId: owner.userId } });
  if (existing > 0) {
    console.log(`Skipping — owner already has ${existing} notifications.`);
    await prisma.$disconnect();
    return;
  }

  const [a, b = a] = events;

  const rows = [
    {
      type: 'order.first_sale',
      data: {
        event_id: a.id,
        order_id: ulid(),
        subtotal_minor: 1_000_000,
        title: 'First sale! 🎉',
        body: `${a.title} just made its first sale.`,
      },
      readAt: null,
      createdAt: hoursAgo(2),
    },
    {
      type: 'broadcast.finished',
      data: {
        broadcast_id: ulid(),
        event_id: a.id,
        subject: 'Doors open at 7pm tonight',
        sent_count: 182,
        failed_count: 1,
        title: 'Broadcast finished',
        body: '"Doors open at 7pm tonight" reached 182 recipient(s).',
      },
      readAt: null,
      createdAt: hoursAgo(6),
    },
    {
      type: 'comment.flagged',
      data: {
        comment_id: ulid(),
        event_id: b.id,
        title: 'Comment reported',
        body: 'A comment on your event was reported by an attendee.',
      },
      readAt: null,
      createdAt: hoursAgo(20),
    },
    {
      type: 'payout.completed',
      data: {
        payout_id: ulid(),
        organisation_id: organisation.id,
        amount_minor: 4_750_000,
        currency: 'NGN',
        title: 'Payout completed',
        body: 'Your payout has settled in your bank account.',
      },
      readAt: hoursAgo(40),
      createdAt: hoursAgo(48),
    },
    {
      type: 'event.starting_soon',
      data: {
        event_id: a.id,
        starts_at: a.startsAt?.toISOString() ?? null,
        title: 'Event starts tomorrow',
        body: `${a.title} starts soon — finalise your setup.`,
      },
      readAt: hoursAgo(70),
      createdAt: hoursAgo(72),
    },
  ];

  await prisma.notification.createMany({
    data: rows.map((row) => ({
      id: ulid(),
      userId: owner.userId,
      type: row.type,
      data: row.data,
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
  });

  console.log(`Seeded ${rows.length} notifications for owner of @${organisation.slug}.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
