import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Organisation } from '../../../../generated/prisma/client';
import {
  dashboardOrderDays,
  dashboardRsvpDays,
} from '../../../../generated/prisma/sql';
import { StorageService } from '../../../../integrations/storage/storage.service';

const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12mo': 365,
};

interface BucketTotals {
  revenue_minor: number;
  tickets: number;
  orders: number;
  rsvps: number;
}

type Metric = keyof BucketTotals;

const METRICS: Metric[] = ['revenue_minor', 'tickets', 'orders', 'rsvps'];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async summary(
    organisation: Organisation,
    rangeInput: string,
  ): Promise<Record<string, unknown>> {
    const range = rangeInput in RANGE_DAYS ? rangeInput : '30d';
    const days = RANGE_DAYS[range];

    const now = new Date();
    const currentFrom = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        (days - 1) * 86_400_000,
    );
    const previousFrom = new Date(currentFrom.getTime() - days * 86_400_000);
    const previousTo = new Date(currentFrom.getTime() - 1000);

    const [current, previous, timeseries, topEvents, nextEvent, activity] =
      await Promise.all([
        this.bucketTotals(organisation.id, currentFrom, now),
        this.bucketTotals(organisation.id, previousFrom, previousTo),
        this.timeseries(organisation.id, currentFrom, now),
        this.topEvents(organisation.id, currentFrom, now),
        this.nextEvent(organisation.id),
        this.recentActivity(organisation.id),
      ]);

    return {
      range,
      currency: 'NGN',
      kpis: Object.fromEntries(
        METRICS.map((metric) => [
          metric,
          {
            current: current[metric],
            previous: previous[metric],
            delta_pct: this.delta(previous[metric], current[metric]),
          },
        ]),
      ),
      timeseries,
      top_events: topEvents,
      next_event: nextEvent,
      recent_activity: activity,
    };
  }

  private async bucketTotals(
    organisationId: string,
    from: Date,
    to: Date,
  ): Promise<BucketTotals> {
    const [orders, rsvps] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          status: 'paid',
          paidAt: { gte: from, lte: to },
          event: { organisationId },
        },
        _sum: { subtotalMinor: true, itemsQuantityTotal: true },
        _count: { _all: true },
      }),
      this.prisma.eventRsvp.count({
        where: {
          createdAt: { gte: from, lte: to },
          event: { organisationId },
        },
      }),
    ]);

    return {
      revenue_minor: Number(orders._sum.subtotalMinor ?? 0n),
      tickets: orders._sum.itemsQuantityTotal ?? 0,
      orders: orders._count._all,
      rsvps,
    };
  }

  private delta(previous: number, current: number): number | null {
    if (previous === 0) {
      return current > 0 ? null : 0.0;
    }

    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private async timeseries(
    organisationId: string,
    from: Date,
    to: Date,
  ): Promise<Array<Record<string, unknown>>> {
    const [orderRows, rsvpRows] = await Promise.all([
      this.prisma.$queryRawTyped(dashboardOrderDays(organisationId, from, to)),
      this.prisma.$queryRawTyped(dashboardRsvpDays(organisationId, from, to)),
    ]);

    const ordersByDay = new Map(orderRows.map((row) => [row.day, row]));
    const rsvpsByDay = new Map(rsvpRows.map((row) => [row.day, row]));

    const days: Array<Record<string, unknown>> = [];
    const cursor = new Date(from);

    while (cursor <= to) {
      const key = cursor.toISOString().slice(0, 10);
      const order = ordersByDay.get(key);
      const rsvp = rsvpsByDay.get(key);

      days.push({
        date: key,
        revenue_minor: Number(order?.revenue_minor ?? 0n),
        tickets: order?.tickets ?? 0,
        orders: order?.orders ?? 0,
        rsvps: rsvp?.rsvps ?? 0,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  }

  private async topEvents(
    organisationId: string,
    from: Date,
    to: Date,
  ): Promise<Array<Record<string, unknown>>> {
    const orgEvents = await this.prisma.event.findMany({
      where: { organisationId },
      select: { id: true },
    });
    const eventIds = orgEvents.map((event) => event.id);

    if (eventIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.order.groupBy({
      by: ['eventId'],
      where: {
        status: 'paid',
        paidAt: { gte: from, lte: to },
        eventId: { in: eventIds },
      },
      _sum: { subtotalMinor: true, itemsQuantityTotal: true },
      orderBy: { _sum: { subtotalMinor: 'desc' } },
      take: 5,
    });

    if (rows.length === 0) {
      return [];
    }

    const total = rows.reduce(
      (sum, row) => sum + Number(row._sum.subtotalMinor ?? 0n),
      0,
    );
    const events = await this.prisma.event.findMany({
      where: { id: { in: rows.map((row) => row.eventId) } },
    });
    const byId = new Map(events.map((event) => [event.id, event]));

    return rows.map((row) => {
      const event = byId.get(row.eventId);
      const revenue = Number(row._sum.subtotalMinor ?? 0n);

      return {
        id: row.eventId,
        title: event?.title ?? '\u2014',
        revenue_minor: revenue,
        tickets_sold: row._sum.itemsQuantityTotal ?? 0,
        flyer_url:
          event?.flyerPath != null ? this.storage.url(event.flyerPath) : null,
        flyer_type: event?.flyerType ?? null,
        share_pct: total > 0 ? Math.round((revenue / total) * 1000) / 10 : 0.0,
      };
    });
  }

  private async nextEvent(
    organisationId: string,
  ): Promise<Record<string, unknown> | null> {
    const event = await this.prisma.event.findFirst({
      where: {
        organisationId,
        status: 'published',
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: 'asc' },
    });

    if (!event) {
      return null;
    }

    return {
      id: event.id,
      title: event.title,
      starts_at: event.startsAt?.toISOString() ?? null,
      ends_at: event.endsAt?.toISOString() ?? null,
      venue_name: event.venueName,
      city: event.city,
      flyer_url:
        event.flyerPath !== null ? this.storage.url(event.flyerPath) : null,
      flyer_type: event.flyerType,
      tickets_sold: event.ticketsSold,
      revenue_minor: Number(event.revenueMinor),
    };
  }

  private async recentActivity(
    organisationId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const [orders, rsvps, flagged, payouts, scans] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: 'paid', event: { organisationId } },
        include: {
          event: { select: { id: true, title: true } },
          user: { select: { id: true, email: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
      this.prisma.eventRsvp.findMany({
        where: { event: { organisationId } },
        include: {
          event: { select: { id: true, title: true } },
          user: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.eventComment.findMany({
        where: { flagsCount: { gt: 0 }, event: { organisationId } },
        include: { event: { select: { id: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.payout.findMany({
        where: { organisationId },
        orderBy: { requestedAt: 'desc' },
        take: 10,
      }),
      this.prisma.issuedTicket.findMany({
        where: {
          status: 'scanned',
          scannedAt: { not: null },
          event: { organisationId },
        },
        include: { event: { select: { id: true, title: true } } },
        orderBy: { scannedAt: 'desc' },
        take: 10,
      }),
    ]);

    const activity: Array<{
      type: string;
      at: string | null;
      data: Record<string, unknown>;
    }> = [];

    for (const order of orders) {
      activity.push({
        type: 'order_paid',
        at: order.paidAt?.toISOString() ?? null,
        data: {
          order_id: order.id,
          event_id: order.eventId,
          event_title: order.event.title,
          buyer_email: order.user.email,
          total_minor: Number(order.totalMinor),
          currency: order.currency,
        },
      });
    }

    for (const rsvp of rsvps) {
      activity.push({
        type: 'rsvp',
        at: rsvp.createdAt.toISOString(),
        data: {
          event_id: rsvp.eventId,
          event_title: rsvp.event.title,
          user_email: rsvp.user.email,
        },
      });
    }

    for (const comment of flagged) {
      activity.push({
        type: 'comment_flagged',
        at: comment.updatedAt.toISOString(),
        data: {
          comment_id: comment.id,
          event_id: comment.eventId,
          event_title: comment.event.title,
          flags_count: comment.flagsCount,
        },
      });
    }

    for (const payout of payouts) {
      activity.push({
        type: 'payout_requested',
        at: payout.requestedAt.toISOString(),
        data: {
          payout_id: payout.id,
          amount_minor: Number(payout.amountMinor),
          currency: payout.currency,
        },
      });

      if (payout.status === 'paid' && payout.paidAt !== null) {
        activity.push({
          type: 'payout_paid',
          at: payout.paidAt.toISOString(),
          data: {
            payout_id: payout.id,
            amount_minor: Number(payout.amountMinor),
            currency: payout.currency,
          },
        });
      }
    }

    for (const ticket of scans) {
      activity.push({
        type: 'ticket_scanned',
        at: ticket.scannedAt?.toISOString() ?? null,
        data: {
          event_id: ticket.eventId,
          event_title: ticket.event.title,
          code: ticket.code,
        },
      });
    }

    return activity
      .filter((entry) => entry.at !== null)
      .sort((a, b) => (a.at! < b.at! ? 1 : -1))
      .slice(0, 10);
  }
}
