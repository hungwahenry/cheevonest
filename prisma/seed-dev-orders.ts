import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ulid } from 'ulid';
import { PrismaClient } from '../src/generated/prisma/client';

const CITIES = [
  'Lagos',
  'Lagos',
  'Lagos',
  'Lagos',
  'Abuja',
  'Abuja',
  'Ibadan',
  'Port Harcourt',
  'Benin City',
  'Enugu',
];

const FIRST_NAMES = ['Ada', 'Tunde', 'Chioma', 'Emeka', 'Funke', 'Kunle', 'Ngozi', 'Segun', 'Amara', 'Femi', 'Zainab', 'Ibrahim', 'Tope', 'Halima', 'Obinna'];
const LAST_NAMES = ['Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Mohammed', 'Okonkwo', 'Adebayo', 'Nwosu', 'Lawal', 'Umeh'];

const FEE_RATE = 0.05;
const BUYERS_COUNT = 25;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(from: Date, to: Date): Date {
  return new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()));
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

  const buyers = [];
  for (let i = 0; i < BUYERS_COUNT; i++) {
    const email = `buyer${i + 1}@cheevo.test`;
    const existing = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    if (existing) {
      buyers.push(existing);
      continue;
    }

    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const created = await prisma.user.create({
      data: {
        id: ulid(),
        email,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            id: ulid(),
            firstName,
            lastName,
            username: `${firstName.toLowerCase()}${lastName.toLowerCase()}${i + 1}`,
            city: pick(CITIES),
            referralCode: ulid().slice(-10).toLowerCase(),
            completedAt: new Date(),
          },
        },
      },
      include: { profile: true },
    });
    buyers.push(created);
  }
  console.log(`Buyers ready: ${buyers.length}`);

  const events = await prisma.event.findMany({
    where: { organisationId: organisation.id, status: { in: ['published', 'past'] } },
  });

  for (const event of events) {
    const tickets = await prisma.eventTicket.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: 'asc' },
    });
    const paidTickets = tickets.filter((ticket) => ticket.grossPrice > 0);
    if (paidTickets.length === 0) continue;

    const existingOrders = await prisma.order.count({ where: { eventId: event.id } });
    if (existingOrders > 0) {
      console.log(`Skipping ${event.title} — already has orders.`);
      continue;
    }

    const now = new Date();
    const windowEnd = event.status === 'past' && event.startsAt ? event.startsAt : now;
    const windowStart = new Date(windowEnd.getTime() - 21 * 24 * 60 * 60 * 1000);

    const soldByTicket = new Map<string, number>();
    let eventQuantity = 0;
    let eventSubtotal = 0n;

    for (const ticket of paidTickets) {
      const target = ticket.soldCount > 0 ? ticket.soldCount : 0;
      let remaining = target;

      while (remaining > 0) {
        const buyer = pick(buyers);
        const quantity = Math.min(remaining, 1 + Math.floor(Math.random() * 3));
        const unitPrice = BigInt(ticket.grossPrice);
        const subtotal = unitPrice * BigInt(quantity);
        const fees = BigInt(Math.round(Number(subtotal) * FEE_RATE));
        const paidAt = randomBetween(windowStart, windowEnd);

        const orderId = ulid();
        const orderItemId = ulid();

        await prisma.order.create({
          data: {
            id: orderId,
            userId: buyer.id,
            eventId: event.id,
            status: 'paid',
            subtotalMinor: subtotal,
            feesMinor: fees,
            totalMinor: subtotal + fees,
            itemsQuantityTotal: quantity,
            currency: event.currency,
            paidAt,
            createdAt: paidAt,
            items: {
              create: [
                {
                  id: orderItemId,
                  eventTicketId: ticket.id,
                  quantity,
                  unitPriceMinor: unitPrice,
                  subtotalMinor: subtotal,
                  ticketName: ticket.name,
                },
              ],
            },
            issuedTickets: {
              create: Array.from({ length: quantity }, () => {
                const scanned = event.status === 'past' && Math.random() < 0.85;
                return {
                  id: ulid(),
                  orderItemId,
                  eventId: event.id,
                  eventTicketId: ticket.id,
                  holderUserId: buyer.id,
                  code: ulid(),
                  status: scanned ? ('scanned' as const) : ('valid' as const),
                  scannedAt: scanned && event.startsAt ? event.startsAt : null,
                  scannedByUserId: scanned ? (owner?.userId ?? null) : null,
                };
              }),
            },
          },
        });

        soldByTicket.set(ticket.id, (soldByTicket.get(ticket.id) ?? 0) + quantity);
        eventQuantity += quantity;
        eventSubtotal += subtotal;
        remaining -= quantity;
      }
    }

    const rsvpers = buyers.slice(0, 10 + Math.floor(Math.random() * (buyers.length - 10)));
    await prisma.eventRsvp.createMany({
      data: rsvpers.map((buyer) => ({
        userId: buyer.id,
        eventId: event.id,
        createdAt: randomBetween(windowStart, windowEnd),
      })),
      skipDuplicates: true,
    });

    await prisma.$transaction([
      ...Array.from(soldByTicket.entries()).map(([ticketId, sold]) =>
        prisma.eventTicket.update({ where: { id: ticketId }, data: { soldCount: sold } })
      ),
      prisma.event.update({
        where: { id: event.id },
        data: {
          ticketsSold: eventQuantity,
          revenueMinor: eventSubtotal,
          rsvpsCount: rsvpers.length,
        },
      }),
    ]);

    console.log(
      `${event.title}: ${eventQuantity} tickets across orders, ₦${Number(eventSubtotal) / 100} revenue, ${rsvpers.length} RSVPs`
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
