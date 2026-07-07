import { Injectable } from '@nestjs/common';
import type { Order, OrderItem } from '../../../generated/prisma/client';
import { TicketSerializer } from '../../tickets/serializers/ticket.serializer';
import { OrderQuote } from '../services/order-quoting.service';
import { OrderForResource } from '../services/orders.service';

@Injectable()
export class OrderSerializer {
  constructor(private readonly tickets: TicketSerializer) {}

  order(order: OrderForResource | Order): Record<string, unknown> {
    return {
      id: order.id,
      event_id: order.eventId,
      status: order.status,
      subtotal_minor: Number(order.subtotalMinor),
      fees_minor: Number(order.feesMinor),
      total_minor: Number(order.totalMinor),
      currency: order.currency,
      paid_at: order.paidAt?.toISOString() ?? null,
      created_at: order.createdAt.toISOString(),
      ...('items' in order
        ? { items: order.items.map((item) => this.item(item)) }
        : {}),
      ...('issuedTickets' in order
        ? {
            issued_tickets: order.issuedTickets.map((ticket) =>
              this.tickets.issuedTicket(ticket),
            ),
          }
        : {}),
    };
  }

  item(item: OrderItem): Record<string, unknown> {
    return {
      id: item.id,
      event_ticket_id: item.eventTicketId,
      ticket_name: item.ticketName,
      quantity: item.quantity,
      unit_price_minor: Number(item.unitPriceMinor),
      subtotal_minor: Number(item.subtotalMinor),
    };
  }

  quote(quote: OrderQuote): Record<string, unknown> {
    return {
      subtotal_minor: quote.subtotalMinor,
      fees_minor: quote.feesMinor,
      total_minor: quote.totalMinor,
      app_savings_minor: quote.appSavingsMinor,
      currency: quote.currency,
      items: quote.items.map((item) => ({
        ticket_id: item.ticketId,
        ticket_name: item.ticketName,
        quantity: item.quantity,
        unit_price_minor: item.unitPriceMinor,
        subtotal_minor: item.subtotalMinor,
      })),
    };
  }
}
