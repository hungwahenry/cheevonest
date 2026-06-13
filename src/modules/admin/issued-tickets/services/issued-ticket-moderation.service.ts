import { Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import type { IssuedTicket } from '../../../../generated/prisma/client';
import { lockIssuedTicketById } from '../../../../generated/prisma/sql';
import { TicketAlreadyScannedException } from '../../../tickets/exceptions/ticket-already-scanned.exception';
import { TicketNotReissuableException } from '../exceptions/ticket-not-reissuable.exception';

@Injectable()
export class IssuedTicketModerationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Revoke a single ticket and free its seat — refuses already-scanned ones. */
  async revoke(ticket: IssuedTicket): Promise<IssuedTicket> {
    if (ticket.status === 'scanned') {
      throw new TicketAlreadyScannedException();
    }

    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.issuedTicket.update({
        where: { id: ticket.id },
        data: { status: 'revoked' },
      });

      if (ticket.status === 'valid') {
        await tx.eventTicket.updateMany({
          where: { id: ticket.eventTicketId, soldCount: { gt: 0 } },
          data: { soldCount: { decrement: 1 } },
        });
        await tx.event.updateMany({
          where: { id: ticket.eventId, ticketsSold: { gt: 0 } },
          data: { ticketsSold: { decrement: 1 } },
        });
      }

      return revoked;
    });
  }

  /** Bring a revoked ticket back with a fresh code; re-applies the sale counters. */
  async reissue(ticket: IssuedTicket): Promise<IssuedTicket> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockIssuedTicketById(ticket.id));

      const locked = await tx.issuedTicket.findUniqueOrThrow({
        where: { id: ticket.id },
      });

      if (locked.status !== 'revoked') {
        throw new TicketNotReissuableException(locked.status);
      }

      const reissued = await tx.issuedTicket.update({
        where: { id: locked.id },
        data: {
          status: 'valid',
          code: ulid(),
          scannedAt: null,
          scannedByUserId: null,
        },
      });

      await tx.eventTicket.update({
        where: { id: locked.eventTicketId },
        data: { soldCount: { increment: 1 } },
      });
      await tx.event.update({
        where: { id: locked.eventId },
        data: { ticketsSold: { increment: 1 } },
      });

      return reissued;
    });
  }

  async transfer(
    ticket: IssuedTicket,
    newHolderId: string,
  ): Promise<IssuedTicket> {
    if (ticket.status === 'scanned') {
      throw new TicketAlreadyScannedException();
    }

    return this.prisma.issuedTicket.update({
      where: { id: ticket.id },
      data: { holderUserId: newHolderId },
    });
  }

  async findOrFail(ticketId: string): Promise<IssuedTicket> {
    const ticket = await this.prisma.issuedTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException();
    }

    return ticket;
  }
}
