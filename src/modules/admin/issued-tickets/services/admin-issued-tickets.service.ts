import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { IssuedTicketStatus } from '../../../../generated/prisma/client';

export const ADMIN_ISSUED_TICKET_INCLUDE = {
  holder: { include: { profile: true } },
  event: true,
  ticket: { select: { name: true } },
} satisfies Prisma.IssuedTicketInclude;

export type AdminIssuedTicket = Prisma.IssuedTicketGetPayload<{
  include: typeof ADMIN_ISSUED_TICKET_INCLUDE;
}>;

@Injectable()
export class AdminIssuedTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    status?: IssuedTicketStatus;
    eventId?: string;
    search?: string;
  }): Promise<{ items: AdminIssuedTicket[]; total: number }> {
    const search = options.search?.trim() ?? '';

    const where: Prisma.IssuedTicketWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.eventId ? { eventId: options.eventId } : {}),
      ...(search !== ''
        ? {
            OR: [
              { code: { contains: search.toUpperCase() } },
              { holder: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.issuedTicket.count({ where }),
      this.prisma.issuedTicket.findMany({
        where,
        include: ADMIN_ISSUED_TICKET_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async load(ticketId: string): Promise<AdminIssuedTicket> {
    return this.prisma.issuedTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: ADMIN_ISSUED_TICKET_INCLUDE,
    });
  }
}
