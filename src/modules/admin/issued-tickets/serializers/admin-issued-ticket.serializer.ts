import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import { AdminIssuedTicket } from '../services/admin-issued-tickets.service';

@Injectable()
export class AdminIssuedTicketSerializer {
  constructor(private readonly refs: EntityRefBuilder) {}

  ticket(ticket: AdminIssuedTicket): Record<string, unknown> {
    return {
      id: ticket.id,
      code: ticket.code,
      status: ticket.status,
      ticket_name: ticket.ticket.name,
      order_id: ticket.orderId,
      scanned_at: ticket.scannedAt?.toISOString() ?? null,
      created_at: ticket.createdAt.toISOString(),
      holder: this.refs.user(ticket.holder),
      event: this.refs.event(ticket.event),
    };
  }
}
