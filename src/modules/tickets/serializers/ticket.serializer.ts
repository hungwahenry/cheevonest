import { Injectable } from '@nestjs/common';
import type { Event, IssuedTicket } from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import { MyTicket } from '../services/ticket-listing.service';

interface TicketCounts {
  valid: number;
  scanned: number;
  revoked: number;
}

@Injectable()
export class TicketSerializer {
  constructor(private readonly storage: StorageService) {}

  issuedTicket(ticket: IssuedTicket): Record<string, unknown> {
    return {
      id: ticket.id,
      code: ticket.code,
      status: ticket.status,
      event_id: ticket.eventId,
      event_ticket_id: ticket.eventTicketId,
      scanned_at: ticket.scannedAt?.toISOString() ?? null,
      created_at: ticket.createdAt.toISOString(),
    };
  }

  myTicket(ticket: MyTicket): Record<string, unknown> {
    return {
      id: ticket.id,
      code: ticket.code,
      status: ticket.status,
      ticket_name: ticket.ticket.name,
      event_ticket_id: ticket.eventTicketId,
      order_id: ticket.orderId,
      scanned_at: ticket.scannedAt?.toISOString() ?? null,
      created_at: ticket.createdAt.toISOString(),
      event: this.eventPayload(ticket.event),
    };
  }

  ticketEvent(event: Event, counts: TicketCounts): Record<string, unknown> {
    return {
      event: this.eventPayload(event),
      counts: {
        ...counts,
        total: counts.valid + counts.scanned + counts.revoked,
      },
    };
  }

  private eventPayload(event: Event): Record<string, unknown> {
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      starts_at: event.startsAt?.toISOString() ?? null,
      ends_at: event.endsAt?.toISOString() ?? null,
      timezone: event.timezone,
      venue_name: event.venueName,
      address: event.address,
      city: event.city,
      flyer_url:
        event.flyerPath !== null ? this.storage.url(event.flyerPath) : null,
      flyer_type: event.flyerType,
    };
  }
}
