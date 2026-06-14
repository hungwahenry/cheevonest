import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { IssuedTicket } from '../../../../generated/prisma/client';
import { TicketAlreadyScannedException } from '../../../tickets/exceptions/ticket-already-scanned.exception';
import { IssuedTicketsService } from '../../../tickets/services/issued-tickets.service';

@Injectable()
export class IssuedTicketModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issuedTickets: IssuedTicketsService,
  ) {}

  /** Refuses scanned tickets (admin policy), then frees the seat via the kernel. */
  async revoke(ticket: IssuedTicket): Promise<IssuedTicket> {
    if (ticket.status === 'scanned') {
      throw new TicketAlreadyScannedException();
    }

    return this.issuedTickets.revoke(ticket.id);
  }

  /** Counter-correct reissue lives in the tickets kernel. */
  async reissue(ticket: IssuedTicket): Promise<IssuedTicket> {
    return this.issuedTickets.reissue(ticket.id);
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
