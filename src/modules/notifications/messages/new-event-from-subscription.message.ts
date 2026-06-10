import type { Event, Organisation } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class NewEventFromSubscriptionMessage implements NotificationMessage {
  readonly type: NotificationType = 'attendee.new_event_from_subscription';

  constructor(private readonly event: Event & { organisation: Organisation }) {}

  data(): Record<string, unknown> {
    return {
      event_id: this.event.id,
      event_slug: this.event.slug,
      event_title: this.event.title,
      organisation_id: this.event.organisationId,
      organisation_name: this.event.organisation.name,
    };
  }

  push(): PushPayload {
    return {
      title: `New from ${this.event.organisation.name}`,
      body: this.event.title,
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: `New from ${this.event.organisation.name}: ${this.event.title}`,
      template: 'new-event-from-subscription',
      context: {
        eventTitle: this.event.title,
        organisationName: this.event.organisation.name,
      },
    };
  }
}
