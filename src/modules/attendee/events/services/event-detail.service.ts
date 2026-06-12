import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { User } from '../../../../generated/prisma/client';
import { AttendeeEventFlags } from '../../../events/serializers/event.serializer';
import { EventsService } from '../../../events/events.service';
import { MutesService } from '../../../notifications/services/mutes.service';

@Injectable()
export class EventDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly mutes: MutesService,
  ) {}

  async findForViewer(slug: string, viewer: User) {
    const event = await this.events.findVisibleDetailBySlug(slug);

    const [subscription, rsvp, interestOverlap, isMuted] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: {
          userId_organisationId: {
            userId: viewer.id,
            organisationId: event.organisationId,
          },
        },
        select: { userId: true },
      }),
      this.prisma.eventRsvp.findUnique({
        where: { userId_eventId: { userId: viewer.id, eventId: event.id } },
        select: { userId: true },
      }),
      this.prisma.eventInterest.count({
        where: {
          eventId: event.id,
          interest: { users: { some: { userId: viewer.id } } },
        },
      }),
      this.mutes.hasMuted(viewer.id, event.id),
    ]);

    const flags: AttendeeEventFlags = {
      isSubscribed: subscription !== null,
      isRsvped: rsvp !== null,
      isMuted,
      interestOverlap,
      ownedByTicket: await this.ownedByTicket(
        viewer.id,
        event.tickets.map((ticket) => ticket.id),
      ),
    };

    return { event, flags };
  }

  private async ownedByTicket(
    viewerId: string,
    ticketIds: string[],
  ): Promise<Map<string, number>> {
    const owned = new Map<string, number>();

    if (ticketIds.length === 0) {
      return owned;
    }

    const [issued, held] = await Promise.all([
      this.prisma.issuedTicket.groupBy({
        by: ['eventTicketId'],
        where: {
          holderUserId: viewerId,
          eventTicketId: { in: ticketIds },
          status: { in: ['valid', 'scanned'] },
        },
        _count: { _all: true },
      }),
      this.prisma.ticketHold.groupBy({
        by: ['eventTicketId'],
        where: {
          eventTicketId: { in: ticketIds },
          expiresAt: { gt: new Date() },
          order: { userId: viewerId },
        },
        _sum: { quantity: true },
      }),
    ]);

    for (const row of issued) {
      owned.set(row.eventTicketId, (owned.get(row.eventTicketId) ?? 0) + row._count._all);
    }
    for (const row of held) {
      owned.set(
        row.eventTicketId,
        (owned.get(row.eventTicketId) ?? 0) + (row._sum.quantity ?? 0),
      );
    }

    return owned;
  }
}
