import { Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type {
  Event,
  IssuedTicket,
  Order,
  OrderItem,
  User,
} from '../../../generated/prisma/client';
import {
  lockIssuedTicketByCode,
  lockIssuedTicketById,
} from '../../../generated/prisma/sql';
import { TicketAlreadyScannedException } from '../exceptions/ticket-already-scanned.exception';
import { TicketCodeNotFoundException } from '../exceptions/ticket-code-not-found.exception';
import { TicketRevokedException } from '../exceptions/ticket-revoked.exception';
import { TicketNotReissuableException } from '../exceptions/ticket-not-reissuable.exception';
import { TicketWrongEventException } from '../exceptions/ticket-wrong-event.exception';

@Injectable()
export class IssuedTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issues one ticket per seat and applies sale counters; runs inside the fulfillment transaction. */
  async issueForOrder(
    tx: Prisma.TransactionClient,
    order: Order,
    items: OrderItem[],
  ): Promise<void> {
    for (const item of items) {
      await tx.issuedTicket.createMany({
        data: Array.from({ length: item.quantity }, () => ({
          id: ulid(),
          orderId: order.id,
          orderItemId: item.id,
          eventId: order.eventId,
          eventTicketId: item.eventTicketId,
          holderUserId: order.userId,
          code: ulid(),
          status: 'valid' as const,
        })),
      });

      await tx.eventTicket.update({
        where: { id: item.eventTicketId },
        data: { soldCount: { increment: item.quantity } },
      });
    }

    await tx.event.update({
      where: { id: order.eventId },
      data: { ticketsSold: { increment: order.itemsQuantityTotal } },
    });
  }

  async scanByCode(
    event: Event,
    code: string,
    scanner: User,
  ): Promise<IssuedTicket> {
    return this.prisma.$transaction(async (tx) => {
      const normalized = code.trim().toUpperCase();
      const locked = await tx.$queryRawTyped(
        lockIssuedTicketByCode(normalized),
      );

      if (locked.length === 0) {
        throw new TicketCodeNotFoundException();
      }

      const ticket = await tx.issuedTicket.findUniqueOrThrow({
        where: { id: locked[0].id },
      });

      if (ticket.eventId !== event.id) {
        throw new TicketWrongEventException();
      }

      if (ticket.status === 'revoked') {
        throw new TicketRevokedException();
      }

      if (ticket.status === 'scanned') {
        throw new TicketAlreadyScannedException(
          ticket.scannedAt?.toISOString() ?? null,
        );
      }

      return tx.issuedTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'scanned',
          scannedAt: new Date(),
          scannedByUserId: scanner.id,
        },
      });
    });
  }

  /**
   * Revokes every non-scanned ticket on an order (a refund) and decrements the
   * sold counters for each — scanned tickets stay counted (the holder attended).
   * Returns how many were revoked. Runs inside the caller's transaction.
   */
  async revokeUnscannedForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<number> {
    const tickets = await tx.issuedTicket.findMany({
      where: { orderId, status: { not: 'scanned' } },
    });

    if (tickets.length === 0) {
      return 0;
    }

    await tx.issuedTicket.updateMany({
      where: { id: { in: tickets.map((ticket) => ticket.id) } },
      data: { status: 'revoked' },
    });

    const perTicketType = new Map<string, number>();
    let perEvent = 0;

    for (const ticket of tickets) {
      if (ticket.status === 'revoked') {
        continue;
      }
      perTicketType.set(
        ticket.eventTicketId,
        (perTicketType.get(ticket.eventTicketId) ?? 0) + 1,
      );
      perEvent += 1;
    }

    for (const [eventTicketId, count] of perTicketType) {
      await tx.eventTicket.updateMany({
        where: { id: eventTicketId, soldCount: { gte: count } },
        data: { soldCount: { decrement: count } },
      });
    }

    if (perEvent > 0) {
      const eventId = tickets[0].eventId;
      await tx.event.updateMany({
        where: { id: eventId, ticketsSold: { gte: perEvent } },
        data: { ticketsSold: { decrement: perEvent } },
      });
    }

    return tickets.length;
  }

  /** Idempotent; frees the seat — sold counters decrement whether the ticket was valid or scanned. */
  async revoke(ticketId: string): Promise<IssuedTicket> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawTyped(lockIssuedTicketById(ticketId));

      if (locked.length === 0) {
        throw new TicketCodeNotFoundException();
      }

      const ticket = await tx.issuedTicket.findUniqueOrThrow({
        where: { id: locked[0].id },
      });

      if (ticket.status === 'revoked') {
        return ticket;
      }

      const revoked = await tx.issuedTicket.update({
        where: { id: ticket.id },
        data: { status: 'revoked' },
      });

      await tx.eventTicket.updateMany({
        where: { id: ticket.eventTicketId, soldCount: { gt: 0 } },
        data: { soldCount: { decrement: 1 } },
      });

      await tx.event.updateMany({
        where: { id: ticket.eventId, ticketsSold: { gt: 0 } },
        data: { ticketsSold: { decrement: 1 } },
      });

      return revoked;
    });
  }

  /** Brings a revoked ticket back with a fresh code and re-applies the sale counters. */
  async reissue(ticketId: string): Promise<IssuedTicket> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockIssuedTicketById(ticketId));

      const ticket = await tx.issuedTicket.findUniqueOrThrow({
        where: { id: ticketId },
      });

      if (ticket.status !== 'revoked') {
        throw new TicketNotReissuableException(ticket.status);
      }

      const reissued = await tx.issuedTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'valid',
          code: ulid(),
          scannedAt: null,
          scannedByUserId: null,
        },
      });

      await tx.eventTicket.update({
        where: { id: ticket.eventTicketId },
        data: { soldCount: { increment: 1 } },
      });
      await tx.event.update({
        where: { id: ticket.eventId },
        data: { ticketsSold: { increment: 1 } },
      });

      return reissued;
    });
  }

  async findScoped(eventId: string, ticketId: string): Promise<IssuedTicket> {
    const ticket = await this.prisma.issuedTicket.findFirst({
      where: { id: ticketId, eventId },
    });

    if (!ticket) {
      throw new NotFoundException();
    }

    return ticket;
  }

  async findHeldOrFail(
    ticketId: string,
    userId: string,
  ): Promise<IssuedTicket> {
    const ticket = await this.prisma.issuedTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.holderUserId !== userId) {
      throw new NotFoundException();
    }

    return ticket;
  }
}
