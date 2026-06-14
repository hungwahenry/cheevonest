import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';

type Interval = 'day' | 'week' | 'month';

function bucketKey(date: Date, interval: Interval): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  if (interval === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
  }

  if (interval === 'week') {
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }

  return d.toISOString().slice(0, 10);
}

@Injectable()
export class PlatformAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<Record<string, unknown>> {
    const cutoff30 = new Date(Date.now() - 30 * 86_400_000);

    const [
      usersTotal,
      usersNew,
      usersSuspended,
      organisers,
      orgsTotal,
      orgsSuspended,
      orgsWithPayout,
      eventsTotal,
      eventsPublished,
      eventsPast,
      gmvTotal,
      gmv30,
      openReports,
      pendingPayouts,
      failedPayouts,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: cutoff30 } } }),
      this.prisma.user.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.user.count({ where: { memberships: { some: {} } } }),
      this.prisma.organisation.count(),
      this.prisma.organisation.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.organisation.count({
        where: { payoutAccount: { isNot: null } },
      }),
      this.prisma.event.count(),
      this.prisma.event.count({ where: { status: 'published' } }),
      this.prisma.event.count({ where: { status: 'past' } }),
      this.prisma.order.aggregate({
        where: { status: 'paid' },
        _sum: { totalMinor: true },
      }),
      this.prisma.order.aggregate({
        where: { status: 'paid', paidAt: { gte: cutoff30 } },
        _sum: { totalMinor: true },
      }),
      this.prisma.report.count({
        where: { status: { in: ['open', 'under_review'] } },
      }),
      this.prisma.payout.count({ where: { status: 'requested' } }),
      this.prisma.payout.count({ where: { status: 'failed' } }),
    ]);

    const orderCounts = await this.prisma.order.groupBy({
      by: ['status'],
      orderBy: { status: 'asc' },
      _count: { _all: true },
    });
    const byStatus = new Map(
      orderCounts.map((row) => [row.status, row._count._all]),
    );

    return {
      users: {
        total: usersTotal,
        new_30d: usersNew,
        suspended: usersSuspended,
        organisers,
      },
      organisations: {
        total: orgsTotal,
        suspended: orgsSuspended,
        with_payout_account: orgsWithPayout,
      },
      events: {
        total: eventsTotal,
        published: eventsPublished,
        past: eventsPast,
      },
      orders: {
        total: orderCounts.reduce((sum, row) => sum + row._count._all, 0),
        paid: byStatus.get('paid') ?? 0,
        refunded: byStatus.get('refunded') ?? 0,
        pending: byStatus.get('pending') ?? 0,
      },
      gmv: {
        currency: 'NGN',
        total_minor: Number(gmvTotal._sum.totalMinor ?? 0n),
        last_30d_minor: Number(gmv30._sum.totalMinor ?? 0n),
      },
      action_items: {
        open_reports: openReports,
        pending_payouts: pendingPayouts,
        failed_payouts: failedPayouts,
      },
    };
  }

  async revenue(
    interval: Interval,
    days: number,
  ): Promise<Record<string, unknown>> {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const orders = await this.prisma.order.findMany({
      where: { status: 'paid', paidAt: { gte: cutoff } },
      select: { paidAt: true, totalMinor: true },
    });

    const buckets = new Map<string, { gmv_minor: number; orders: number }>();
    for (const order of orders) {
      if (!order.paidAt) continue;
      const key = bucketKey(order.paidAt, interval);
      const b = buckets.get(key) ?? { gmv_minor: 0, orders: 0 };
      b.gmv_minor += Number(order.totalMinor);
      b.orders += 1;
      buckets.set(key, b);
    }

    return {
      interval,
      currency: 'NGN',
      series: [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bucket, v]) => ({ bucket, ...v })),
    };
  }

  async payments(days: number): Promise<Record<string, unknown>> {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.payment.groupBy({
      by: ['provider', 'status'],
      where: { createdAt: { gte: cutoff } },
      _count: { _all: true },
    });

    const byProvider: Record<
      string,
      {
        successful: number;
        failed: number;
        total: number;
        success_rate: number;
      }
    > = {};
    let successful = 0;
    let failed = 0;

    for (const row of rows) {
      const p = (byProvider[row.provider] ??= {
        successful: 0,
        failed: 0,
        total: 0,
        success_rate: 0,
      });
      p.total += row._count._all;
      if (row.status === 'successful') {
        p.successful += row._count._all;
        successful += row._count._all;
      }
      if (row.status === 'failed') {
        p.failed += row._count._all;
        failed += row._count._all;
      }
    }

    for (const p of Object.values(byProvider)) {
      p.success_rate =
        p.total > 0 ? Math.round((p.successful / p.total) * 10000) / 10000 : 0;
    }

    const total = successful + failed;

    return {
      by_provider: byProvider,
      totals: {
        successful,
        failed,
        total,
        success_rate:
          total > 0 ? Math.round((successful / total) * 10000) / 10000 : 0,
      },
    };
  }

  async engagement(days: number): Promise<Record<string, unknown>> {
    const cutoff = new Date(Date.now() - days * 86_400_000);

    const [comments, rsvps, subs] = await this.prisma.$transaction([
      this.prisma.eventComment.findMany({
        where: { createdAt: { gte: cutoff } },
        select: { createdAt: true },
      }),
      this.prisma.eventRsvp.findMany({
        where: { createdAt: { gte: cutoff } },
        select: { createdAt: true },
      }),
      this.prisma.subscription.findMany({
        where: { createdAt: { gte: cutoff } },
        select: { createdAt: true },
      }),
    ]);

    const buckets = new Map<
      string,
      { comments: number; rsvps: number; subscriptions: number }
    >();
    const add = (
      rows: { createdAt: Date }[],
      field: 'comments' | 'rsvps' | 'subscriptions',
    ) => {
      for (const row of rows) {
        const key = bucketKey(row.createdAt, 'day');
        const b = buckets.get(key) ?? {
          comments: 0,
          rsvps: 0,
          subscriptions: 0,
        };
        b[field] += 1;
        buckets.set(key, b);
      }
    };
    add(comments, 'comments');
    add(rsvps, 'rsvps');
    add(subs, 'subscriptions');

    return {
      interval: 'day',
      series: [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bucket, v]) => ({ bucket, ...v })),
    };
  }
}
