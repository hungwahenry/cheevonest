import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { EventStatus } from '../../../../generated/prisma/client';

export const ADMIN_EVENT_INCLUDE = {
  organisation: true,
} satisfies Prisma.EventInclude;

export type AdminEvent = Prisma.EventGetPayload<{
  include: typeof ADMIN_EVENT_INCLUDE;
}>;

@Injectable()
export class AdminEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    search?: string;
    status?: EventStatus;
  }): Promise<{ items: AdminEvent[]; total: number }> {
    const search = options.search?.trim() ?? '';

    const where: Prisma.EventWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(search !== ''
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: ADMIN_EVENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async detail(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: ADMIN_EVENT_INCLUDE,
    });

    if (!event) {
      throw new NotFoundException();
    }

    const [
      ordersAgg,
      ordersRecent,
      ticketTypes,
      rsvpsCount,
      commentsCount,
      flaggedComments,
      reportsAgainst,
    ] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { eventId, status: 'paid' },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { eventId },
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.eventTicket.findMany({
        where: { eventId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.eventRsvp.count({ where: { eventId } }),
      this.prisma.eventComment.count({ where: { eventId } }),
      this.prisma.eventComment.count({
        where: { eventId, flagsCount: { gt: 0 } },
      }),
      this.prisma.report.count({
        where: { targetType: 'event', targetId: eventId },
      }),
    ]);

    return {
      event,
      stats: {
        tickets_sold: event.ticketsSold,
        revenue_minor: Number(event.revenueMinor),
        orders_count: ordersAgg._count._all,
        rsvps_count: rsvpsCount,
        comments_count: commentsCount,
        flagged_comments: flaggedComments,
        reports_against: reportsAgainst,
      },
      ordersRecent,
      ticketTypes,
    };
  }
}
