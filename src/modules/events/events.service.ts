import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { Event } from '../../generated/prisma/client';

export const EVENT_RESOURCE_INCLUDE = {
  images: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
  features: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
  tickets: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
  interests: {
    include: { interest: true },
    orderBy: { interest: { sortOrder: Prisma.SortOrder.asc } },
  },
} satisfies Prisma.EventInclude;

export type EventForResource = Prisma.EventGetPayload<{
  include: typeof EVENT_RESOURCE_INCLUDE;
}>;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrFail(id: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundException();
    }

    return event;
  }

  async loadForResource(id: string): Promise<EventForResource> {
    return this.prisma.event.findUniqueOrThrow({
      where: { id },
      include: EVENT_RESOURCE_INCLUDE,
    });
  }

  /** Keeps the event's ticket aggregates in sync after ticket mutations. */
  async recomputeTicketAggregates(
    eventId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const aggregates = await tx.eventTicket.aggregate({
      where: { eventId },
      _count: true,
      _min: { grossPrice: true },
      _max: { grossPrice: true },
    });

    await tx.event.update({
      where: { id: eventId },
      data: {
        ticketsCount: aggregates._count,
        ticketsMinPrice: aggregates._min.grossPrice,
        ticketsMaxPrice: aggregates._max.grossPrice,
      },
    });
  }
}
