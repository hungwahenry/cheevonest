import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import type { IssuedTicket, User } from '../../../generated/prisma/client';
import { lockIssuedTicketById } from '../../../generated/prisma/sql';
import {
  TICKET_TRANSFERRED,
  TicketTransferredEvent,
} from '../events/ticket-transferred.event';
import { TicketTransferRules } from '../rules/ticket-transfer.rules';

@Injectable()
export class TicketTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: TicketTransferRules,
    private readonly emitter: EventEmitter2,
  ) {}

  async transfer(
    ticketId: string,
    sender: User,
    toUserId: string,
  ): Promise<IssuedTicket> {
    await this.rules.ensureEnabled();

    const recipient = await this.prisma.user.findUnique({
      where: { id: toUserId },
    });
    await this.rules.ensureRecipient(sender, recipient);

    const transferred = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockIssuedTicketById(ticketId));

      const ticket = await tx.issuedTicket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket || ticket.holderUserId !== sender.id) {
        throw new NotFoundException();
      }

      this.rules.ensureTransferable(ticket);
      await this.rules.ensureRecipientUnderCap(tx, ticket, toUserId);

      const updated = await tx.issuedTicket.update({
        where: { id: ticket.id },
        data: {
          holderUserId: toUserId,
          code: ulid(),
          scannedAt: null,
          scannedByUserId: null,
        },
      });

      await tx.ticketTransfer.create({
        data: {
          id: ulid(),
          issuedTicketId: ticket.id,
          eventId: ticket.eventId,
          fromUserId: sender.id,
          toUserId,
        },
      });

      return updated;
    });

    await this.emitter.emitAsync(
      TICKET_TRANSFERRED,
      new TicketTransferredEvent(transferred.id, sender.id, toUserId),
    );

    return transferred;
  }
}
