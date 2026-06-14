import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: EntityRefBuilder,
  ) {}

  /** Revenue leaderboards + breakdowns over a range — top events, organisers, categories, cities. */
  async leaderboards(
    days: number,
    limit: number,
  ): Promise<Record<string, unknown>> {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const orders = await this.prisma.order.findMany({
      where: { status: 'paid', paidAt: { gte: cutoff } },
      select: {
        eventId: true,
        userId: true,
        totalMinor: true,
        itemsQuantityTotal: true,
      },
    });

    if (orders.length === 0) {
      return {
        currency: 'NGN',
        top_events: [],
        top_organisers: [],
        by_category: [],
        top_cities: [],
      };
    }

    const perEvent = new Map<
      string,
      { gmv: number; orders: number; tickets: number }
    >();
    for (const order of orders) {
      const agg = perEvent.get(order.eventId) ?? {
        gmv: 0,
        orders: 0,
        tickets: 0,
      };
      agg.gmv += Number(order.totalMinor);
      agg.orders += 1;
      agg.tickets += order.itemsQuantityTotal;
      perEvent.set(order.eventId, agg);
    }

    const events = await this.prisma.event.findMany({
      where: { id: { in: [...perEvent.keys()] } },
    });
    const eventById = new Map(events.map((event) => [event.id, event]));

    const orgs = await this.prisma.organisation.findMany({
      where: { id: { in: [...new Set(events.map((e) => e.organisationId))] } },
      include: { category: true },
    });
    const orgById = new Map(orgs.map((org) => [org.id, org]));

    const perOrg = new Map<
      string,
      { gmv: number; orders: number; events: Set<string> }
    >();
    const perCategory = new Map<number, number>();
    for (const [eventId, agg] of perEvent) {
      const event = eventById.get(eventId);
      if (!event) continue;
      const org = perOrg.get(event.organisationId) ?? {
        gmv: 0,
        orders: 0,
        events: new Set<string>(),
      };
      org.gmv += agg.gmv;
      org.orders += agg.orders;
      org.events.add(eventId);
      perOrg.set(event.organisationId, org);

      const categoryId = orgById.get(event.organisationId)?.categoryId ?? -1;
      perCategory.set(categoryId, (perCategory.get(categoryId) ?? 0) + agg.gmv);
    }

    const categoryName = new Map<number, string>();
    for (const org of orgs) {
      if (org.category) categoryName.set(org.category.id, org.category.name);
    }

    const profiles = await this.prisma.profile.findMany({
      where: {
        userId: { in: [...new Set(orders.map((o) => o.userId))] },
        city: { not: null },
      },
      select: { userId: true, city: true },
    });
    const cityByUser = new Map(profiles.map((p) => [p.userId, p.city!]));
    const perCity = new Map<string, { gmv: number; orders: number }>();
    for (const order of orders) {
      const city = cityByUser.get(order.userId);
      if (!city) continue;
      const agg = perCity.get(city) ?? { gmv: 0, orders: 0 };
      agg.gmv += Number(order.totalMinor);
      agg.orders += 1;
      perCity.set(city, agg);
    }

    return {
      currency: 'NGN',
      top_events: [...perEvent.entries()]
        .map(([id, agg]) => ({ event: eventById.get(id), agg }))
        .filter((row) => row.event)
        .sort((a, b) => b.agg.gmv - a.agg.gmv)
        .slice(0, limit)
        .map((row) => ({
          event: this.refs.event(row.event!),
          gmv_minor: row.agg.gmv,
          orders: row.agg.orders,
          tickets: row.agg.tickets,
        })),
      top_organisers: [...perOrg.entries()]
        .map(([id, agg]) => ({ org: orgById.get(id), agg }))
        .filter((row) => row.org)
        .sort((a, b) => b.agg.gmv - a.agg.gmv)
        .slice(0, limit)
        .map((row) => ({
          organisation: this.refs.organisation(row.org!),
          gmv_minor: row.agg.gmv,
          orders: row.agg.orders,
          events: row.agg.events.size,
        })),
      by_category: [...perCategory.entries()]
        .map(([categoryId, gmv]) => ({
          category:
            categoryId === -1
              ? { id: null, name: 'Uncategorised' }
              : {
                  id: categoryId,
                  name: categoryName.get(categoryId) ?? 'Unknown',
                },
          gmv_minor: gmv,
        }))
        .sort((a, b) => b.gmv_minor - a.gmv_minor),
      top_cities: [...perCity.entries()]
        .map(([city, agg]) => ({
          city,
          gmv_minor: agg.gmv,
          orders: agg.orders,
        }))
        .sort((a, b) => b.gmv_minor - a.gmv_minor)
        .slice(0, limit),
    };
  }

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
