import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ulid } from 'ulid';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

const DAY_MS = 86_400_000;
const IN_FLIGHT = ['requested', 'approved', 'processing'] as const;

async function holdDays(prisma: PrismaClient): Promise<number> {
  const cfg = await prisma.systemConfig.findUnique({
    where: { key: 'payouts.hold_window_days' },
  });
  const v = (cfg?.value as { v?: unknown } | null)?.v;
  return typeof v === 'number' ? v : 2;
}

async function rebuild(prisma: PrismaClient, days: number): Promise<number> {
  const removed = await prisma.ledgerEntry.deleteMany({});

  const orders = await prisma.order.findMany({
    where: { status: { in: ['paid', 'refunded'] }, paidAt: { not: null } },
    select: {
      id: true,
      status: true,
      subtotalMinor: true,
      currency: true,
      paidAt: true,
      event: { select: { organisationId: true } },
    },
  });

  const entries: Prisma.LedgerEntryCreateManyInput[] = [];

  for (const order of orders) {
    const availableAt = new Date(order.paidAt!.getTime() + days * DAY_MS);
    const base = {
      organisationId: order.event.organisationId,
      currency: order.currency,
      sourceType: 'order',
      sourceId: order.id,
      availableAt,
    };

    entries.push({
      id: ulid(),
      type: 'sale',
      amountMinor: order.subtotalMinor,
      ...base,
    });

    if (order.status === 'refunded') {
      entries.push({
        id: ulid(),
        type: 'refund',
        amountMinor: -order.subtotalMinor,
        ...base,
      });
    }
  }

  if (entries.length > 0) {
    await prisma.ledgerEntry.createMany({ data: entries });
  }

  console.log(
    `Ledger rebuilt: removed ${removed.count}, inserted ${entries.length} entries from ${orders.length} orders.`,
  );

  return entries.length;
}

async function reconcile(prisma: PrismaClient, days: number): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const orgs = await prisma.organisation.findMany({ select: { id: true } });
  let mismatches = 0;

  for (const org of orgs) {
    const [settled, unsettled, inFlight, paidOut, matured, held] =
      await Promise.all([
        prisma.order.aggregate({
          where: {
            status: 'paid',
            paidAt: { lte: cutoff },
            event: { organisationId: org.id },
          },
          _sum: { subtotalMinor: true },
        }),
        prisma.order.aggregate({
          where: {
            status: 'paid',
            OR: [{ paidAt: null }, { paidAt: { gt: cutoff } }],
            event: { organisationId: org.id },
          },
          _sum: { subtotalMinor: true },
        }),
        prisma.payout.aggregate({
          where: { organisationId: org.id, status: { in: [...IN_FLIGHT] } },
          _sum: { amountMinor: true },
        }),
        prisma.payout.aggregate({
          where: { organisationId: org.id, status: 'paid' },
          _sum: { amountMinor: true },
        }),
        prisma.ledgerEntry.aggregate({
          where: { organisationId: org.id, availableAt: { lte: now } },
          _sum: { amountMinor: true },
        }),
        prisma.ledgerEntry.aggregate({
          where: { organisationId: org.id, availableAt: { gt: now } },
          _sum: { amountMinor: true },
        }),
      ]);

    const inFlightMinor = Number(inFlight._sum.amountMinor ?? 0n);
    const paidOutMinor = Number(paidOut._sum.amountMinor ?? 0n);

    const derivedAvailable = Math.max(
      0,
      Number(settled._sum.subtotalMinor ?? 0n) - inFlightMinor - paidOutMinor,
    );
    const derivedPending =
      Number(unsettled._sum.subtotalMinor ?? 0n) + inFlightMinor;

    const ledgerAvailable = Math.max(
      0,
      Number(matured._sum.amountMinor ?? 0n) - inFlightMinor - paidOutMinor,
    );
    const ledgerPending = Number(held._sum.amountMinor ?? 0n) + inFlightMinor;

    if (
      ledgerAvailable !== derivedAvailable ||
      ledgerPending !== derivedPending
    ) {
      mismatches += 1;
      console.log(
        `MISMATCH org ${org.id}: available ${derivedAvailable} -> ${ledgerAvailable}, pending ${derivedPending} -> ${ledgerPending}`,
      );
    }
  }

  console.log(
    mismatches === 0
      ? `Reconciliation OK — ledger matches derived balance for all ${orgs.length} org(s).`
      : `Reconciliation FAILED — ${mismatches} org(s) mismatched.`,
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      options: '-c TimeZone=UTC',
      connectionString: process.env.DATABASE_URL,
    }),
  });

  const days = await holdDays(prisma);
  await rebuild(prisma, days);
  await reconcile(prisma, days);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
