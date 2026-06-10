import { Injectable } from '@nestjs/common';
import type { IssuedTicket } from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import { MyTicket } from '../services/ticket-listing.service';

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
      order_id: ticket.orderId,
      scanned_at: ticket.scannedAt?.toISOString() ?? null,
      created_at: ticket.createdAt.toISOString(),
      event: {
        id: ticket.event.id,
        title: ticket.event.title,
        slug: ticket.event.slug,
        starts_at: ticket.event.startsAt?.toISOString() ?? null,
        ends_at: ticket.event.endsAt?.toISOString() ?? null,
        timezone: ticket.event.timezone,
        venue_name: ticket.event.venueName,
        address: ticket.event.address,
        city: ticket.event.city,
        flyer_url:
          ticket.event.flyerPath !== null
            ? this.storage.url(ticket.event.flyerPath)
            : null,
        flyer_type: ticket.event.flyerType,
      },
    };
  }
}
