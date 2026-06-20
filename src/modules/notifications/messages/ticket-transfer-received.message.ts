import type { Event, IssuedTicket } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class TicketTransferReceivedMessage implements NotificationMessage {
  readonly type: NotificationType = 'attendee.ticket_transfer_received';

  constructor(
    private readonly ticket: IssuedTicket & { event: Event },
    private readonly senderName: string,
  ) {}

  data(): Record<string, unknown> {
    return {
      ticket_id: this.ticket.id,
      event_id: this.ticket.eventId,
      event_slug: this.ticket.event.slug,
      event_title: this.ticket.event.title,
      from: this.senderName,
    };
  }

  push(): PushPayload {
    return {
      title: 'You received a ticket',
      body: `${this.senderName} sent you a ticket to ${this.ticket.event.title}.`,
      data: {},
    };
  }

  mail(): MailPayload | null {
    return null;
  }
}
