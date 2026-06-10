import type { Event } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export interface DigestStats {
  revenue_minor: number;
  tickets: number;
  orders: number;
}

export class DailySalesDigestMessage implements NotificationMessage {
  readonly type: NotificationType = 'order.daily_digest';

  constructor(
    private readonly event: Event,
    private readonly stats: DigestStats,
  ) {}

  data(): Record<string, unknown> {
    return {
      event_id: this.event.id,
      revenue_minor: this.stats.revenue_minor,
      tickets: this.stats.tickets,
      orders: this.stats.orders,
    };
  }

  push(): null {
    return null;
  }

  mail(): MailPayload {
    return {
      subject: `Daily sales: ${this.event.title}`,
      template: 'daily-sales-digest',
      context: {
        eventTitle: this.event.title,
        revenue: (this.stats.revenue_minor / 100).toLocaleString('en-NG'),
        tickets: this.stats.tickets,
        orders: this.stats.orders,
      },
    };
  }
}
