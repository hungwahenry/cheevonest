import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Currency, Event } from '../../../generated/prisma/client';
import { UnknownTicketException } from '../exceptions/unknown-ticket.exception';
import { OrderChannel } from '../orders.constants';
import { OrderWindowRules } from '../rules/order-window.rules';
import { OrderPricingService } from './order-pricing.service';
import { OrderItemInput } from './orders.service';

export interface OrderQuote {
  subtotalMinor: number;
  feesMinor: number;
  totalMinor: number;
  currency: Currency;
  items: Array<{
    ticketId: string;
    ticketName: string;
    quantity: number;
    unitPriceMinor: number;
    subtotalMinor: number;
  }>;
}

@Injectable()
export class OrderQuotingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: OrderPricingService,
    private readonly windowRules: OrderWindowRules,
  ) {}

  async quote(
    event: Event,
    items: OrderItemInput[],
    channel: OrderChannel = 'app',
  ): Promise<OrderQuote> {
    this.windowRules.ensureEventOpenForSales(event);

    const tickets = await this.prisma.eventTicket.findMany({
      where: {
        eventId: event.id,
        id: { in: items.map((item) => item.ticket_id) },
      },
    });
    const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));

    let subtotal = 0;
    const lines = items.map((item) => {
      const ticket = byId.get(item.ticket_id);

      if (!ticket) {
        throw new UnknownTicketException();
      }

      const lineSubtotal = ticket.grossPrice * item.quantity;
      subtotal += lineSubtotal;

      return {
        ticketId: ticket.id,
        ticketName: ticket.name,
        quantity: item.quantity,
        unitPriceMinor: ticket.grossPrice,
        subtotalMinor: lineSubtotal,
      };
    });

    const fees = await this.pricing.fees(subtotal, channel);

    return {
      subtotalMinor: subtotal,
      feesMinor: fees,
      totalMinor: subtotal + fees,
      currency: event.currency,
      items: lines,
    };
  }
}
