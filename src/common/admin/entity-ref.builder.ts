import { Injectable } from '@nestjs/common';
import type {
  Broadcast,
  Event,
  EventComment,
  Order,
  Organisation,
  Payment,
  Payout,
  Profile,
  User,
} from '../../generated/prisma/client';
import { StorageService } from '../../integrations/storage/storage.service';
import { EntityRef } from './entity-ref';

type UserWithProfile = User & { profile: Profile | null };

/** Maps any domain model to the universal admin cross-link shape. */
@Injectable()
export class EntityRefBuilder {
  constructor(private readonly storage: StorageService) {}

  user(user: UserWithProfile): EntityRef {
    const name =
      `${user.profile?.firstName ?? ''} ${user.profile?.lastName ?? ''}`.trim();

    return {
      type: 'user',
      id: user.id,
      label: name || user.profile?.username || user.email,
      sublabel: user.email,
      thumbnail:
        user.profile?.avatarPath != null
          ? this.storage.url(user.profile.avatarPath)
          : null,
      deep_link: `/admin/users/${user.id}`,
    };
  }

  organisation(organisation: Organisation): EntityRef {
    return {
      type: 'organisation',
      id: organisation.id,
      label: organisation.name,
      sublabel: organisation.slug,
      thumbnail:
        organisation.logoPath != null
          ? this.storage.url(organisation.logoPath)
          : null,
      deep_link: `/admin/organisations/${organisation.id}`,
    };
  }

  event(event: Event): EntityRef {
    return {
      type: 'event',
      id: event.id,
      label: event.title,
      sublabel: event.status,
      thumbnail:
        event.flyerPath != null ? this.storage.url(event.flyerPath) : null,
      deep_link: `/admin/events/${event.id}`,
    };
  }

  order(order: Order): EntityRef {
    return {
      type: 'order',
      id: order.id,
      label: `Order ${order.id.slice(-8)}`,
      sublabel: order.status,
      deep_link: `/admin/orders/${order.id}`,
    };
  }

  payment(payment: Payment): EntityRef {
    return {
      type: 'payment',
      id: payment.id,
      label: payment.reference,
      sublabel: payment.status,
      deep_link: `/admin/payments/${payment.id}`,
    };
  }

  payout(payout: Payout): EntityRef {
    return {
      type: 'payout',
      id: payout.id,
      label: `Payout ${payout.id.slice(-8)}`,
      sublabel: payout.status,
      deep_link: `/admin/payouts/${payout.id}`,
    };
  }

  comment(comment: EventComment): EntityRef {
    return {
      type: 'comment',
      id: comment.id,
      label: comment.body ? comment.body.slice(0, 60) : '(gif)',
      sublabel: comment.flagsCount > 0 ? `${comment.flagsCount} flag(s)` : null,
      deep_link: `/admin/comments/${comment.id}`,
    };
  }

  broadcast(broadcast: Broadcast): EntityRef {
    return {
      type: 'broadcast',
      id: broadcast.id,
      label: broadcast.subject,
      sublabel: broadcast.status,
      deep_link: `/admin/broadcasts/${broadcast.id}`,
    };
  }

  /** Resolve a polymorphic (target_type, target_id) pair from a loaded record. */
  fromTarget(type: string | null, record: unknown): EntityRef | null {
    if (type === null || record === null || record === undefined) {
      return null;
    }

    switch (type) {
      case 'user':
        return this.user(record as UserWithProfile);
      case 'organisation':
        return this.organisation(record as Organisation);
      case 'event':
        return this.event(record as Event);
      case 'event_comment':
        return this.comment(record as EventComment);
      default:
        return null;
    }
  }
}
