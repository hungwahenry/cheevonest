import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ulid } from 'ulid';
import { PrismaClient } from '../src/generated/prisma/client';

const TOP_LEVEL = [
  'Is there parking at the venue?',
  'So hyped for this one 🔥',
  'What time do doors actually open?',
  'Can I still get a ticket at the gate?',
  'Last year was unreal, count me in.',
  'Is the venue wheelchair accessible?',
  'Bringing the whole squad 💃',
  'Will there be food vendors on site?',
  'Does the ticket cover both days?',
  'First time attending — any tips?',
  'The lineup is crazy good this year.',
  'Any chance of a student discount?',
  'Is re-entry allowed if I step out?',
  'Already booked my hotel, let’s go!',
  'What’s the dress code for this?',
];

const REPLIES = [
  'Same question here!',
  'Yes, doors open at 7pm sharp.',
  'There’s a paid lot right next door.',
  'See you there! 🙌',
  'Pretty sure re-entry is fine with a stamp.',
  'Food trucks were great last time.',
  'Tickets are almost sold out btw.',
];

const SPAM = [
  'CHEAP TICKETS DM ME NOW 👉 wa.me/2340000000',
  'Make $500/day working from home, click my bio!!!',
  'Follow me for free giveaways 🎁🎁🎁',
];

const GIFS = [
  { id: 'l0HlvtIPzPdt2usKs', url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', width: 480, height: 270 },
  { id: '3oEjI6SIIHBdRxXI40', url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', width: 480, height: 480 },
  { id: 'xT0xeJpnrWC4XWblEk', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif', width: 480, height: 264 },
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
  if (!owner) {
    throw new Error('Owner member not found for organisation.');
  }

  const buyers = await prisma.user.findMany({
    where: { email: { startsWith: 'buyer', endsWith: '@cheevo.test' } },
  });
  if (buyers.length === 0) {
    throw new Error('No dev buyers found — run seed-dev-orders first.');
  }

  const events = await prisma.event.findMany({
    where: { organisationId: organisation.id, status: { in: ['published', 'past'] } },
  });

  for (const event of events) {
    const existing = await prisma.eventComment.count({ where: { eventId: event.id } });
    if (existing > 0) {
      console.log(`Skipping ${event.title} — already has comments.`);
      continue;
    }

    const now = new Date();
    const windowEnd = event.status === 'past' && event.startsAt ? event.startsAt : now;
    const windowStart = new Date(windowEnd.getTime() - 21 * 24 * 60 * 60 * 1000);

    const topicCount = 6 + Math.floor(Math.random() * 5);
    const topics = shuffle(TOP_LEVEL).slice(0, topicCount);

    let created = 0;
    let flagged = 0;

    for (const topic of topics) {
      const author = pick(buyers);
      const createdAt = randomBetween(windowStart, windowEnd);
      const withGif = Math.random() < 0.2;
      const gif = withGif ? pick(GIFS) : null;
      const commentId = ulid();

      const repliers = shuffle(buyers).slice(0, Math.floor(Math.random() * 4));
      const likers = shuffle(buyers).slice(0, Math.floor(Math.random() * 12));

      await prisma.eventComment.create({
        data: {
          id: commentId,
          eventId: event.id,
          userId: author.id,
          body: withGif && Math.random() < 0.5 ? null : topic,
          gif: gif ?? undefined,
          likesCount: likers.length,
          repliesCount: repliers.length,
          createdAt,
          likes: {
            create: likers.map((user) => ({
              userId: user.id,
              createdAt: randomBetween(createdAt, windowEnd),
            })),
          },
        },
      });
      created += 1;

      for (const replier of repliers) {
        const replyAt = randomBetween(createdAt, windowEnd);
        await prisma.eventComment.create({
          data: {
            id: ulid(),
            eventId: event.id,
            userId: replier.id,
            parentId: commentId,
            body: pick(REPLIES),
            createdAt: replyAt,
          },
        });
        created += 1;
      }
    }

    const spamCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < spamCount; i++) {
      const author = pick(buyers);
      const createdAt = randomBetween(windowStart, windowEnd);
      const flagThis = Math.random() < 0.6;

      await prisma.eventComment.create({
        data: {
          id: ulid(),
          eventId: event.id,
          userId: author.id,
          body: pick(SPAM),
          flagsCount: flagThis ? 1 : 0,
          createdAt,
          flags: flagThis
            ? {
                create: [
                  {
                    flaggedByUserId: owner.userId,
                    reason: 'Spam / promotional',
                    createdAt: randomBetween(createdAt, windowEnd),
                  },
                ],
              }
            : undefined,
        },
      });
      created += 1;
      if (flagThis) flagged += 1;
    }

    console.log(`${event.title}: ${created} comments (${flagged} flagged)`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
