import type { Event } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class EventStartingSoonAttendeeMessage implements NotificationMessage {
  readonly type: NotificationType = 'attendee.event_starting_soon';

  constructor(private readonly event: Event) {}

  data(): Record<string, unknown> {
    return {
      event_id: this.event.id,
      event_slug: this.event.slug,
      event_title: this.event.title,
      starts_at: this.event.startsAt?.toISOString() ?? null,
    };
  }

  push(): PushPayload {
    return {
      title: `Tomorrow: ${this.event.title}`,
      body: 'See you there.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: `${this.event.title} is tomorrow`,
      template: 'event-starting-soon-attendee',
      context: { eventTitle: this.event.title, eventSlug: this.event.slug },
    };
  }
}
