import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { Event, IssuedTicketStatus } from '../../../generated/prisma/client';

export const MY_TICKET_INCLUDE = {
  event: true,
  ticket: { select: { name: true } },
} satisfies Prisma.IssuedTicketInclude;

export type MyTicket = Prisma.IssuedTicketGetPayload<{
  include: typeof MY_TICKET_INCLUDE;
}>;

export const ORGANIZER_TICKET_INCLUDE = {
  holder: { include: { profile: true } },
  ticket: { select: { name: true } },
  scannedBy: { include: { profile: true } },
  order: true,
  transfers: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  },
  _count: { select: { transfers: true } },
} satisfies Prisma.IssuedTicketInclude;

export type OrganizerTicket = Prisma.IssuedTicketGetPayload<{
  include: typeof ORGANIZER_TICKET_INCLUDE;
}>;

export interface TicketPage<T> {
  items: T[];
  total: number;
}

function eventWhenFilter(when: 'upcoming' | 'past'): Prisma.EventWhereInput {
  const now = new Date();

  if (when === 'past') {
    return {
      OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }],
    };
  }

  return {
    OR: [
      { endsAt: { gte: now } },
      { endsAt: null, startsAt: { gte: now } },
      { endsAt: null, startsAt: null },
    ],
  };
}

interface CheckInCounts {
  scanned: number;
  valid: number;
  revoked: number;
}

export interface CheckInSummary extends CheckInCounts {
  tickets: (CheckInCounts & { ticket_id: string; ticket_name: string })[];
}

@Injectable()
export class TicketListingService {
  constructor(private readonly prisma: PrismaService) {}

  async heldBy(
    userId: string,
    options: {
      page: number;
      perPage: number;
      status?: IssuedTicketStatus;
      when?: 'upcoming' | 'past';
    },
  ): Promise<TicketPage<MyTicket>> {
    const where: Prisma.IssuedTicketWhereInput = {
      holderUserId: userId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.when ? { event: eventWhenFilter(options.when) } : {}),
    };

    const order: Prisma.SortOrder = options.when === 'upcoming' ? 'asc' : 'desc';

    const [total, items] = await this.prisma.$transaction([
      this.prisma.issuedTicket.count({ where }),
      this.prisma.issuedTicket.findMany({
        where,
        include: MY_TICKET_INCLUDE,
        orderBy: [
          { event: { startsAt: { sort: order, nulls: 'last' } } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async heldOne(ticketId: string): Promise<MyTicket> {
    return this.prisma.issuedTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: MY_TICKET_INCLUDE,
    });
  }

  /** Events the user holds tickets for, each with per-status counts. */
  async eventsHeldBy(
    userId: string,
    options: { page: number; perPage: number; when?: 'upcoming' | 'past' },
  ): Promise<TicketPage<{ event: Event; counts: CheckInCounts }>> {
    const where: Prisma.IssuedTicketWhereInput = {
      holderUserId: userId,
      ...(options.when ? { event: eventWhenFilter(options.when) } : {}),
    };

    const grouped = await this.prisma.issuedTicket.groupBy({
      by: ['eventId', 'status'],
      where,
      _count: { _all: true },
    });

    const countsByEvent = new Map<string, CheckInCounts>();
    for (const row of grouped) {
      const entry = countsByEvent.get(row.eventId) ?? {
        scanned: 0,
        valid: 0,
        revoked: 0,
      };
      entry[row.status] = row._count._all;
      countsByEvent.set(row.eventId, entry);
    }

    const eventIds = [...countsByEvent.keys()];
    const order: Prisma.SortOrder = options.when === 'upcoming' ? 'asc' : 'desc';

    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      orderBy: [{ startsAt: { sort: order, nulls: 'last' } }, { id: 'desc' }],
      skip: (options.page - 1) * options.perPage,
      take: options.perPage,
    });

    return {
      total: eventIds.length,
      items: events.map((event) => ({
        event,
        counts: countsByEvent.get(event.id) ?? {
          scanned: 0,
          valid: 0,
          revoked: 0,
        },
      })),
    };
  }

  /** A user's tickets for one event, ordered by ticket type then status. */
  async heldForEvent(userId: string, eventId: string): Promise<MyTicket[]> {
    return this.prisma.issuedTicket.findMany({
      where: { holderUserId: userId, eventId },
      include: MY_TICKET_INCLUDE,
      orderBy: [
        { ticket: { sortOrder: 'asc' } },
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async forEvent(
    eventId: string,
    options: {
      page: number;
      perPage: number;
      status?: IssuedTicketStatus;
      search?: string | null;
    },
  ): Promise<TicketPage<OrganizerTicket>> {
    const search = options.search?.trim() ?? '';

    const where: Prisma.IssuedTicketWhereInput = {
      eventId,
      ...(options.status ? { status: options.status } : {}),
      ...(search !== ''
        ? {
            OR: [
              { code: { contains: search.toUpperCase() } },
              { holder: { email: { contains: search, mode: 'insensitive' } } },
              {
                holder: {
                  profile: {
                    OR: [
                      { username: { contains: search, mode: 'insensitive' } },
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.issuedTicket.count({ where }),
      this.prisma.issuedTicket.findMany({
        where,
        include: ORGANIZER_TICKET_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async forEventOne(ticketId: string): Promise<OrganizerTicket> {
    return this.prisma.issuedTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: ORGANIZER_TICKET_INCLUDE,
    });
  }

  async checkInSummary(eventId: string): Promise<CheckInSummary> {
    const [rows, tickets] = await Promise.all([
      this.prisma.issuedTicket.groupBy({
        by: ['eventTicketId', 'status'],
        where: { eventId },
        _count: { _all: true },
        orderBy: { eventTicketId: 'asc' },
      }),
      this.prisma.eventTicket.findMany({
        where: { eventId },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const totals: CheckInCounts = { scanned: 0, valid: 0, revoked: 0 };
    const byTicket = new Map<string, CheckInCounts>();

    for (const row of rows) {
      const count = row._count._all;
      totals[row.status] += count;

      const entry = byTicket.get(row.eventTicketId) ?? {
        scanned: 0,
        valid: 0,
        revoked: 0,
      };
      entry[row.status] = count;
      byTicket.set(row.eventTicketId, entry);
    }

    return {
      ...totals,
      tickets: tickets.map((ticket) => ({
        ticket_id: ticket.id,
        ticket_name: ticket.name,
        ...(byTicket.get(ticket.id) ?? { scanned: 0, valid: 0, revoked: 0 }),
      })),
    };
  }
}
