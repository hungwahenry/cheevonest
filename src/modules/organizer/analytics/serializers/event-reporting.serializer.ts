import { Injectable } from '@nestjs/common';
import { OrderSerializer } from '../../../orders/serializers/order.serializer';
import { UserSerializer } from '../../../users/serializers/user.serializer';
import { EventOrder, EventRsvp } from '../services/event-reporting.service';

@Injectable()
export class EventReportingSerializer {
  constructor(
    private readonly users: UserSerializer,
    private readonly orders: OrderSerializer,
  ) {}

  order(order: EventOrder): Record<string, unknown> {
    const profile = order.user.profile;
    const displayName =
      `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();

    return {
      id: order.id,
      status: order.status,
      subtotal_minor: Number(order.subtotalMinor),
      fees_minor: Number(order.feesMinor),
      total_minor: Number(order.totalMinor),
      currency: order.currency,
      items_count: order.itemsQuantityTotal,
      paid_at: order.paidAt?.toISOString() ?? null,
      cancelled_at: order.cancelledAt?.toISOString() ?? null,
      refunded_at: order.refundedAt?.toISOString() ?? null,
      created_at: order.createdAt.toISOString(),
      buyer: {
        email: order.user.email,
        username: profile?.username ?? null,
        display_name: displayName !== '' ? displayName : null,
        avatar_url: profile ? this.users.avatarUrl(profile) : null,
      },
      items: order.items.map((item) => this.orders.item(item)),
    };
  }

  rsvp(rsvp: EventRsvp): Record<string, unknown> {
    const profile = rsvp.user.profile;
    const displayName =
      `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();

    return {
      id: rsvp.userId,
      username: profile?.username ?? null,
      display_name: displayName !== '' ? displayName : null,
      avatar_url: profile ? this.users.avatarUrl(profile) : null,
      rsvped_at: rsvp.createdAt.toISOString(),
    };
  }
}
