import type { Event, Order } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationChannel, NotificationType } from '../notification-types';

export class OrderPaidMessage implements NotificationMessage {
  readonly type: NotificationType = 'attendee.order_paid';

  constructor(private readonly order: Order & { event: Event }) {}

  data(): Record<string, unknown> {
    return {
      order_id: this.order.id,
      event_id: this.order.eventId,
      event_title: this.order.event.title,
      tickets: this.order.itemsQuantityTotal,
    };
  }

  push(): PushPayload {
    return {
      title: 'Your tickets are ready',
      body: `Order for ${this.order.event.title} confirmed.`,
      data: {},
    };
  }

  guaranteedChannels(): NotificationChannel[] {
    return this.order.channel === 'web' ? ['email'] : [];
  }

  mail(): MailPayload {
    return {
      subject: `Your tickets for ${this.order.event.title}`,
      template: 'order-paid',
      context: {
        eventTitle: this.order.event.title,
        eventSlug: this.order.event.slug,
        tickets: this.order.itemsQuantityTotal,
        accessToken: this.order.accessToken,
      },
    };
  }
}
