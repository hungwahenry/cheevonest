import type { Event } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class EventStartingSoonOrganizerMessage implements NotificationMessage {
  readonly type: NotificationType = 'event.starting_soon';

  constructor(private readonly event: Event) {}

  data(): Record<string, unknown> {
    return {
      event_id: this.event.id,
      starts_at: this.event.startsAt?.toISOString() ?? null,
    };
  }

  push(): PushPayload {
    return {
      title: 'Event starts tomorrow',
      body: `${this.event.title} starts soon — finalise your setup.`,
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: `Your event starts tomorrow: ${this.event.title}`,
      template: 'event-starting-soon-organizer',
      context: { eventTitle: this.event.title },
    };
  }
}
