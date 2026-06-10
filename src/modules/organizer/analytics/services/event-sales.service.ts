import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import { eventTicketRevenue } from '../../../../generated/prisma/sql';

@Injectable()
export class EventSalesService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(event: Event): Promise<Record<string, unknown>> {
    const [totals, tickets, revenueRows] = await Promise.all([
      this.prisma.order.aggregate({
        where: { eventId: event.id, status: 'paid' },
        _sum: { feesMinor: true, totalMinor: true },
        _count: { _all: true },
      }),
      this.prisma.eventTicket.findMany({
        where: { eventId: event.id },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.$queryRawTyped(eventTicketRevenue(event.id)),
    ]);

    const revenueByTicket = new Map(
      revenueRows.map((row) => [row.event_ticket_id, row.revenue_minor]),
    );

    return {
      gross_minor: Number(totals._sum.totalMinor ?? 0n),
      fees_minor: Number(totals._sum.feesMinor ?? 0n),
      revenue_minor: Number(event.revenueMinor),
      orders_count: totals._count._all,
      tickets_sold: event.ticketsSold,
      per_ticket: tickets.map((ticket) => ({
        ticket_id: ticket.id,
        name: ticket.name,
        sold_count: ticket.soldCount,
        quantity: ticket.quantity,
        revenue_minor: Number(revenueByTicket.get(ticket.id) ?? 0n),
      })),
    };
  }
}
