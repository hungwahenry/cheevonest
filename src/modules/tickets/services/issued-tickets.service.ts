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
