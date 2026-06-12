import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { EventTicket } from '../../../generated/prisma/client';
import { TicketMaxPerOrderExceededException } from '../exceptions/ticket-max-per-order-exceeded.exception';
import { TicketNotOnSaleException } from '../exceptions/ticket-not-on-sale.exception';
import { TicketPerUserLimitExceededException } from '../exceptions/ticket-per-user-limit-exceeded.exception';
import { TicketSalesEndedException } from '../exceptions/ticket-sales-ended.exception';
import { TicketSalesNotStartedException } from '../exceptions/ticket-sales-not-started.exception';
import { TicketSoldOutException } from '../exceptions/ticket-sold-out.exception';
import { TicketValidityEndedException } from '../exceptions/ticket-validity-ended.exception';
import { UnknownTicketException } from '../exceptions/unknown-ticket.exception';

@Injectable()
export class TicketAvailabilityRules {
  /** Must run inside the checkout transaction, after the ticket row is locked. */
  async ensureBuyable(
    tx: Prisma.TransactionClient,
    ticket: EventTicket | null,
    quantity: number,
    now: Date,
    userId: string,
  ): Promise<EventTicket> {
    if (ticket === null) {
      throw new UnknownTicketException();
    }

    if (ticket.status !== 'on_sale') {
      throw new TicketNotOnSaleException(ticket.name);
    }

    if (ticket.maxPerOrder !== null && quantity > ticket.maxPerOrder) {
      throw new TicketMaxPerOrderExceededException(
        ticket.name,
        ticket.maxPerOrder,
      );
    }

    if (ticket.maxPerUser !== null) {
      const owned = await this.ownedByUser(tx, ticket.id, userId, now);

      if (owned + quantity > ticket.maxPerUser) {
        throw new TicketPerUserLimitExceededException(
          ticket.name,
          ticket.maxPerUser,
        );
      }
    }

    if (ticket.salesStartsAt !== null && ticket.salesStartsAt > now) {
      throw new TicketSalesNotStartedException(ticket.name);
    }

    if (ticket.salesEndsAt !== null && ticket.salesEndsAt < now) {
      throw new TicketSalesEndedException(ticket.name);
    }

    if (ticket.validTo !== null && ticket.validTo < now) {
      throw new TicketValidityEndedException(ticket.name);
    }

    if (ticket.quantity !== null) {
      const activeHolds = await tx.ticketHold.aggregate({
        where: { eventTicketId: ticket.id, expiresAt: { gt: now } },
        _sum: { quantity: true },
      });

      const available =
        ticket.quantity - ticket.soldCount - (activeHolds._sum.quantity ?? 0);

      if (quantity > available) {
        throw available <= 0
          ? TicketSoldOutException.noneLeft(ticket.name)
          : TicketSoldOutException.notEnoughLeft(ticket.name, available);
      }
    }

    return ticket;
  }

  private async ownedByUser(
    tx: Prisma.TransactionClient,
    ticketId: string,
    userId: string,
    now: Date,
  ): Promise<number> {
    const issued = await tx.issuedTicket.count({
      where: {
        eventTicketId: ticketId,
        holderUserId: userId,
        status: { in: ['valid', 'scanned'] },
      },
    });

    const held = await tx.ticketHold.aggregate({
      where: {
        eventTicketId: ticketId,
        expiresAt: { gt: now },
        order: { userId },
      },
      _sum: { quantity: true },
    });

    return issued + (held._sum.quantity ?? 0);
  }
}
