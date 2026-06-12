import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import {
  eventSalesDays,
  eventTopCities,
} from '../../../../generated/prisma/sql';

@Injectable()
export class EventAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(event: Event): Promise<Record<string, unknown>> {
    const firstPaid = await this.prisma.order.aggregate({
      where: { eventId: event.id, status: 'paid', paidAt: { not: null } },
      _min: { paidAt: true },
    });

    const series = firstPaid._min.paidAt
      ? await this.dailySeries(event.id, firstPaid._min.paidAt)
      : [];

    const cities = await this.prisma.$queryRawTyped(eventTopCities(event.id));

    let runningTickets = 0;
    let runningRevenue = 0;

    return {
      currency: event.currency,
      cumulative_series: series.map((row) => {
        runningTickets += row.tickets_sold as number;
        runningRevenue += row.revenue_minor as number;

        return {
          date: row.date,
          tickets_sold: runningTickets,
          revenue_minor: runningRevenue,
        };
      }),
      daily_series: series,
      top_cities: cities.map((row) => ({
        city: row.city,
        buyers_count: row.buyers_count,
      })),
    };
  }

  private async dailySeries(
    eventId: string,
    from: Date,
  ): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.$queryRawTyped(eventSalesDays(eventId));
    const byDay = new Map(rows.map((row) => [row.day, row]));

    const days: Array<Record<string, unknown>> = [];
    const cursor = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
    );
    const now = new Date();

    while (cursor <= now) {
      const key = cursor.toISOString().slice(0, 10);
      const row = byDay.get(key);

      days.push({
        date: key,
        tickets_sold: row?.tickets_sold ?? 0,
        revenue_minor: Number(row?.revenue_minor ?? 0n),
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  }
}
