import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { IssuedTicket, User } from '../../../generated/prisma/client';
import { TicketPerUserLimitExceededException } from '../../orders/exceptions/ticket-per-user-limit-exceeded.exception';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { TicketAlreadyScannedException } from '../../tickets/exceptions/ticket-already-scanned.exception';
import { TicketRevokedException } from '../../tickets/exceptions/ticket-revoked.exception';
import { UsersService } from '../../users/services/users.service';
import { CannotTransferToSelfException } from '../exceptions/cannot-transfer-to-self.exception';
import { InvalidTransferRecipientException } from '../exceptions/invalid-transfer-recipient.exception';
import { RecipientBlockedException } from '../exceptions/recipient-blocked.exception';
import { TransfersDisabledException } from '../exceptions/transfers-disabled.exception';

@Injectable()
export class TicketTransferRules {
  constructor(
    private readonly config: SystemConfigService,
    private readonly users: UsersService,
  ) {}

  async ensureEnabled(): Promise<void> {
    if (!(await this.config.bool('tickets.transfers_enabled', true))) {
      throw new TransfersDisabledException();
    }
  }

  async ensureRecipient(sender: User, recipient: User | null): Promise<User> {
    if (recipient === null || recipient.suspendedAt !== null) {
      throw new InvalidTransferRecipientException();
    }

    if (recipient.id === sender.id) {
      throw new CannotTransferToSelfException();
    }

    const blocked = await this.users.mutuallyBlockedUserIds(sender.id);

    if (blocked.includes(recipient.id)) {
      throw new RecipientBlockedException();
    }

    return recipient;
  }

  ensureTransferable(ticket: IssuedTicket): void {
    if (ticket.status === 'scanned') {
      throw new TicketAlreadyScannedException(
        ticket.scannedAt?.toISOString() ?? null,
      );
    }

    if (ticket.status === 'revoked') {
      throw new TicketRevokedException();
    }
  }

  async ensureRecipientUnderCap(
    tx: Prisma.TransactionClient,
    ticket: IssuedTicket,
    recipientId: string,
  ): Promise<void> {
    const ticketType = await tx.eventTicket.findUnique({
      where: { id: ticket.eventTicketId },
    });

    if (!ticketType || ticketType.maxPerUser === null) {
      return;
    }

    const owned = await tx.issuedTicket.count({
      where: {
        eventTicketId: ticket.eventTicketId,
        holderUserId: recipientId,
        status: { in: ['valid', 'scanned'] },
      },
    });

    if (owned + 1 > ticketType.maxPerUser) {
      throw new TicketPerUserLimitExceededException(
        ticketType.name,
        ticketType.maxPerUser,
      );
    }
  }
}
