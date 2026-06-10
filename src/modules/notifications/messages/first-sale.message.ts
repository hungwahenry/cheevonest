import type { Event, Order } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class FirstSaleMessage implements NotificationMessage {
  readonly type: NotificationType = 'order.first_sale';

  constructor(
    private readonly event: Event,
    private readonly order: Order,
  ) {}

  data(): Record<string, unknown> {
    return {
      event_id: this.event.id,
      order_id: this.order.id,
      subtotal_minor: Number(this.order.subtotalMinor),
    };
  }

  push(): PushPayload {
    return {
      title: 'First sale! 🎉',
      body: `${this.event.title} just made its first sale.`,
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: `First sale on ${this.event.title} 🎉`,
      template: 'first-sale',
      context: { eventTitle: this.event.title },
    };
  }
}
