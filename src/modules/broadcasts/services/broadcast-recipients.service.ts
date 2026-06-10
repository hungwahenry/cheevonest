import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type {
  BroadcastAudience,
  Event,
} from '../../../generated/prisma/client';
import { SuppressionsService } from './suppressions.service';

export interface Recipient {
  userId: string;
  email: string;
}

@Injectable()
export class BroadcastRecipientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppressions: SuppressionsService,
  ) {}

  /** Audience minus globally- and org-suppressed addresses, resolved fresh. */
  async resolve(
    event: Event,
    audience: BroadcastAudience,
  ): Promise<Recipient[]> {
    const userIds = new Set<string>();

    if (audience === 'ticket_holders' || audience === 'both') {
      const orders = await this.prisma.order.findMany({
        where: { eventId: event.id, status: 'paid' },
        select: { userId: true },
        distinct: ['userId'],
      });
      orders.forEach((order) => userIds.add(order.userId));
    }

    if (audience === 'rsvpers' || audience === 'both') {
      const rsvps = await this.prisma.eventRsvp.findMany({
        where: { eventId: event.id },
        select: { userId: true },
      });
      rsvps.forEach((rsvp) => userIds.add(rsvp.userId));
    }

    if (userIds.size === 0) {
      return [];
    }

    const suppressed = await this.suppressions.suppressedEmailsFor(
      event.organisationId,
    );

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, email: true },
    });

    return users
      .filter((user) => !suppressed.has(user.email.toLowerCase()))
      .map((user) => ({ userId: user.id, email: user.email }));
  }
}
