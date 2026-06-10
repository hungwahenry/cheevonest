import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { OrderStatus } from '../../../../generated/prisma/client';

export const EVENT_ORDER_INCLUDE = {
  user: { include: { profile: true } },
  items: true,
} satisfies Prisma.OrderInclude;

export type EventOrder = Prisma.OrderGetPayload<{
  include: typeof EVENT_ORDER_INCLUDE;
}>;

export const EVENT_RSVP_INCLUDE = {
  user: { include: { profile: true } },
} satisfies Prisma.EventRsvpInclude;

export type EventRsvp = Prisma.EventRsvpGetPayload<{
  include: typeof EVENT_RSVP_INCLUDE;
}>;

@Injectable()
export class EventReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async ordersPage(
    eventId: string,
    options: { page: number; perPage: number; status?: OrderStatus },
  ): Promise<{ items: EventOrder[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      eventId,
      ...(options.status ? { status: options.status } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: EVENT_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async orderOne(eventId: string, orderId: string): Promise<EventOrder | null> {
    return this.prisma.order.findFirst({
      where: { id: orderId, eventId },
      include: EVENT_ORDER_INCLUDE,
    });
  }

  async rsvpsPage(
    eventId: string,
    options: { page: number; perPage: number },
  ): Promise<{ items: EventRsvp[]; total: number }> {
    const where = { eventId };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.eventRsvp.count({ where }),
      this.prisma.eventRsvp.findMany({
        where,
        include: EVENT_RSVP_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }
}
