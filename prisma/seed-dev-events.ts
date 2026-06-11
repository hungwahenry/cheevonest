import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ulid } from 'ulid';
import { PrismaClient } from '../src/generated/prisma/client';

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

  const interests = await prisma.interest.findMany({ take: 3 });
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const events = [
    {
      title: 'Lagos Rooftop Sessions',
      slug: `lagos-rooftop-sessions-${ulid().toLowerCase().slice(-6)}`,
      description:
        'An intimate rooftop night of live performances, amapiano sets and skyline views. Doors open 7pm, first act 8pm sharp.',
      status: 'published' as const,
      startsAt: new Date(now + 9 * day),
      endsAt: new Date(now + 9 * day + 6 * 60 * 60 * 1000),
      publishedAt: new Date(now - 5 * day),
      venueName: 'The Good Beach',
      address: '4 Water Corporation Road, Victoria Island',
      city: 'Lagos',
      ticketsSold: 86,
      revenueMinor: BigInt(86 * 500000),
      rsvpsCount: 142,
      tickets: [
        { name: 'Early Bird', grossPrice: 350000, quantity: 50, soldCount: 50, status: 'paused' as const, sortOrder: 0 },
        { name: 'Regular', grossPrice: 500000, quantity: 150, soldCount: 36, status: 'on_sale' as const, sortOrder: 1 },
        { name: 'VIP Table (4)', grossPrice: 4000000, quantity: 10, soldCount: 2, status: 'on_sale' as const, sortOrder: 2 },
      ],
    },
    {
      title: 'Nine After Dark: Detty December Edition',
      slug: `nine-after-dark-detty-${ulid().toLowerCase().slice(-6)}`,
      description:
        'The December takeover. Three rooms, four DJs, zero chill. Free entry before 10pm with RSVP.',
      status: 'published' as const,
      startsAt: new Date(now + 21 * day),
      endsAt: new Date(now + 21 * day + 8 * 60 * 60 * 1000),
      publishedAt: new Date(now - 2 * day),
      venueName: 'Club Quilox',
      address: '873 Ozumba Mbadiwe Avenue, Victoria Island',
      city: 'Lagos',
      ticketsSold: 12,
      revenueMinor: BigInt(12 * 1000000),
      rsvpsCount: 38,
      tickets: [
        { name: 'General', grossPrice: 1000000, quantity: 300, soldCount: 12, status: 'on_sale' as const, sortOrder: 0 },
        { name: 'Free RSVP (before 10pm)', grossPrice: 0, quantity: 200, soldCount: 0, status: 'on_sale' as const, sortOrder: 1 },
      ],
    },
    {
      title: 'Sunset Paint & Sip',
      slug: `sunset-paint-and-sip-${ulid().toLowerCase().slice(-6)}`,
      description: 'Canvas, cocktails and a golden-hour playlist. All materials provided.',
      status: 'draft' as const,
      startsAt: null,
      endsAt: null,
      publishedAt: null,
      venueName: null,
      address: null,
      city: 'Lagos',
      ticketsSold: 0,
      revenueMinor: BigInt(0),
      rsvpsCount: 0,
      tickets: [],
    },
    {
      title: 'Nine Year One: Anniversary Brunch',
      slug: `nine-year-one-brunch-${ulid().toLowerCase().slice(-6)}`,
      description: 'We turned one. Bottomless brunch, live band, and a few surprises.',
      status: 'past' as const,
      startsAt: new Date(now - 30 * day),
      endsAt: new Date(now - 30 * day + 5 * 60 * 60 * 1000),
      publishedAt: new Date(now - 50 * day),
      venueName: 'Atmosphere Rooftop',
      address: '20 Idejo Street, Victoria Island',
      city: 'Lagos',
      ticketsSold: 174,
      revenueMinor: BigInt(174 * 750000),
      rsvpsCount: 203,
      tickets: [
        { name: 'Brunch Pass', grossPrice: 750000, quantity: 180, soldCount: 174, status: 'paused' as const, sortOrder: 0 },
      ],
    },
  ];

  for (const data of events) {
    const { tickets, ...event } = data;
    const prices = tickets.map((ticket) => ticket.grossPrice);

    const created = await prisma.event.create({
      data: {
        id: ulid(),
        organisationId: organisation.id,
        ...event,
        ticketsCount: tickets.length,
        ticketsMinPrice: prices.length > 0 ? Math.min(...prices) : null,
        ticketsMaxPrice: prices.length > 0 ? Math.max(...prices) : null,
        tickets: {
          create: tickets.map((ticket) => ({ id: ulid(), ...ticket })),
        },
        interests: {
          create: interests.map((interest) => ({ interestId: interest.id })),
        },
      },
    });

    console.log(`Created [${created.status}] ${created.title} (${created.id})`);
  }

  await prisma.organisation.update({
    where: { id: organisation.id },
    data: { eventsCount: { increment: events.length } },
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
