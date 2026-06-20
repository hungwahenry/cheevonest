import { Injectable } from '@nestjs/common';
import { OrganizerTicket } from '../../tickets/services/ticket-listing.service';
import { UserSerializer } from '../../users/serializers/user.serializer';

@Injectable()
export class OrganizerIssuedTicketSerializer {
  constructor(private readonly users: UserSerializer) {}

  issuedTicket(ticket: OrganizerTicket): Record<string, unknown> {
    const profile = ticket.holder.profile;
    const holderName =
      `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();
    const scannerProfile = ticket.scannedBy?.profile;
    const scannerName =
      `${scannerProfile?.firstName ?? ''} ${scannerProfile?.lastName ?? ''}`.trim();

    return {
      id: ticket.id,
      code: ticket.code,
      status: ticket.status,
      ticket_name: ticket.ticket.name,
      order_id: ticket.orderId,
      scanned_at: ticket.scannedAt?.toISOString() ?? null,
      created_at: ticket.createdAt.toISOString(),
      transferred: ticket._count.transfers > 0,
      transferred_at: ticket.transfers[0]?.createdAt.toISOString() ?? null,
      holder: {
        email: ticket.holder.email,
        username: profile?.username ?? null,
        display_name: holderName !== '' ? holderName : null,
        avatar_url: profile ? this.users.avatarUrl(profile) : null,
      },
      scanned_by: ticket.scannedBy
        ? {
            email: ticket.scannedBy.email,
            display_name: scannerName !== '' ? scannerName : null,
          }
        : null,
      order: {
        id: ticket.order.id,
        total_minor: Number(ticket.order.totalMinor),
        currency: ticket.order.currency,
        paid_at: ticket.order.paidAt?.toISOString() ?? null,
      },
    };
  }
}
