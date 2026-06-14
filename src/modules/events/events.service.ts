import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { SearchIndexerService } from '../search/services/search-indexer.service';
import { Prisma } from '../../generated/prisma/client';
import type { Event, EventStatus, User } from '../../generated/prisma/client';
import { ORGANISATION_RESOURCE_INCLUDE } from '../organisations/organisations.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  /** Removes an event and all side effects: stored media, search index, org counter. */
  async purge(event: Event): Promise<void> {
    const [images, features] = await Promise.all([
      this.prisma.eventImage.findMany({
        where: { eventId: event.id },
        select: { path: true },
      }),
      this.prisma.eventFeature.findMany({
        where: { eventId: event.id },
        select: { imagePath: true },
      }),
    ]);

    if (event.flyerPath !== null) {
      await this.storage.delete(event.flyerPath);
    }
    for (const image of images) {
      await this.storage.delete(image.path);
    }
    for (const feature of features) {
      if (feature.imagePath !== null) {
        await this.storage.delete(feature.imagePath);
      }
    }

    await this.searchIndexer.deindex('event', event.id);

    await this.prisma.$transaction(async (tx) => {
      // Orders + issued tickets first: order_items hold a RESTRICT FK to
      // event_tickets, so the event cascade can't drop tickets until these go.
      await tx.order.deleteMany({ where: { eventId: event.id } });
      await tx.issuedTicket.deleteMany({ where: { eventId: event.id } });
      await tx.event.delete({ where: { id: event.id } });
      await tx.organisation.update({
        where: { id: event.organisationId },
        data: { eventsCount: { decrement: 1 } },
      });
    });
  }

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

  /** The public event page: published or past, with org, tickets, features. */
  async findPublicPageBySlug(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: { in: ['published', 'past'] } },
      include: {
        organisation: true,
        tickets: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
        features: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
      },
    });

    if (!event) {
      throw new NotFoundException();
    }

    return event;
  }

  /** The attendee detail page: published or past, full resource + org resource. */
  async findVisibleDetailBySlug(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        slug,
        status: { in: ['published', 'past'] },
        organisation: { suspendedAt: null },
      },
      include: {
        ...EVENT_RESOURCE_INCLUDE,
        organisation: { include: ORGANISATION_RESOURCE_INCLUDE },
      },
    });

    if (!event) {
      throw new NotFoundException();
    }

    return event;
  }

  async pageForMember(
    user: User,
    options: {
      page: number;
      perPage: number;
      status?: EventStatus;
      search?: string | null;
    },
  ): Promise<{ items: EventForResource[]; total: number }> {
    const search = options.search?.trim() ?? '';

    const where: Prisma.EventWhereInput = {
      organisation: { members: { some: { userId: user.id } } },
      ...(options.status ? { status: options.status } : {}),
      ...(search !== ''
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { venueName: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: EVENT_RESOURCE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
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
