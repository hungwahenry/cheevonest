import type {
  Event,
  EventComment,
  Order,
  Organisation,
  Payout,
} from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

const limit = (value: string | null, max: number): string =>
  value === null
    ? ''
    : value.length > max
      ? `${value.slice(0, max - 1)}…`
      : value;

export class CommentReplyMessage implements NotificationMessage {
  readonly type: NotificationType = 'attendee.comment_reply';

  constructor(private readonly reply: EventComment & { event: Event }) {}

  data(): Record<string, unknown> {
    return {
      reply_id: this.reply.id,
      parent_id: this.reply.parentId,
      event_id: this.reply.eventId,
      event_slug: this.reply.event.slug,
      preview: limit(this.reply.body, 120),
    };
  }

  push(): PushPayload {
    return {
      title: 'New reply on your comment',
      body: limit(this.reply.body, 100) || 'Tap to view the reply.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'Someone replied to your comment',
      template: 'comment-reply',
      context: {
        eventTitle: this.reply.event.title,
        preview: limit(this.reply.body, 200),
      },
    };
  }
}

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

  mail(): MailPayload {
    return {
      subject: `Your tickets for ${this.order.event.title}`,
      template: 'order-paid',
      context: {
        eventTitle: this.order.event.title,
        tickets: this.order.itemsQuantityTotal,
      },
    };
  }
}

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

export class PayoutCompletedMessage implements NotificationMessage {
  readonly type: NotificationType = 'payout.completed';

  constructor(private readonly payout: Payout) {}

  data(): Record<string, unknown> {
    return {
      payout_id: this.payout.id,
      organisation_id: this.payout.organisationId,
      amount_minor: Number(this.payout.netMinor),
      currency: this.payout.currency,
    };
  }

  push(): PushPayload {
    return {
      title: 'Payout completed',
      body: 'Your payout has settled in your bank account.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'Payout completed',
      template: 'payout-completed',
      context: {
        bankName: this.payout.bankName,
        accountNumber: this.payout.accountNumber,
      },
    };
  }
}

export class PayoutFailedMessage implements NotificationMessage {
  readonly type: NotificationType = 'payout.failed';

  constructor(private readonly payout: Payout) {}

  data(): Record<string, unknown> {
    return {
      payout_id: this.payout.id,
      organisation_id: this.payout.organisationId,
      amount_minor: Number(this.payout.netMinor),
      currency: this.payout.currency,
      failed_reason: this.payout.failedReason,
    };
  }

  push(): PushPayload {
    return {
      title: 'Payout failed',
      body: 'A payout could not be completed. Tap to review.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'Payout failed',
      template: 'payout-failed',
      context: { reason: this.payout.failedReason ?? 'Unknown reason' },
    };
  }
}

export class CommentFlaggedMessage implements NotificationMessage {
  readonly type: NotificationType = 'comment.flagged';

  constructor(private readonly comment: EventComment) {}

  data(): Record<string, unknown> {
    return {
      comment_id: this.comment.id,
      event_id: this.comment.eventId,
    };
  }

  push(): PushPayload {
    return {
      title: 'Comment reported',
      body: 'A comment on your event was reported by an attendee.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'A comment on your event was reported',
      template: 'comment-flagged',
      context: { preview: limit(this.comment.body, 200) },
    };
  }
}

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
      context: { eventTitle: this.event.title },
    };
  }
}

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
