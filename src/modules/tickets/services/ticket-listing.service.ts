import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { IssuedTicketStatus } from '../../../generated/prisma/client';

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
} satisfies Prisma.IssuedTicketInclude;

export type OrganizerTicket = Prisma.IssuedTicketGetPayload<{
  include: typeof ORGANIZER_TICKET_INCLUDE;
}>;

export interface TicketPage<T> {
  items: T[];
  total: number;
}

@Injectable()
export class TicketListingService {
  constructor(private readonly prisma: PrismaService) {}

  async heldBy(
    userId: string,
    options: { page: number; perPage: number; status?: IssuedTicketStatus },
  ): Promise<TicketPage<MyTicket>> {
    const where: Prisma.IssuedTicketWhereInput = {
      holderUserId: userId,
      ...(options.status ? { status: options.status } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.issuedTicket.count({ where }),
      this.prisma.issuedTicket.findMany({
        where,
        include: MY_TICKET_INCLUDE,
        orderBy: [
          { event: { startsAt: { sort: 'desc', nulls: 'last' } } },
          { createdAt: 'desc' },
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
        orderBy: { createdAt: 'desc' },
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
}
