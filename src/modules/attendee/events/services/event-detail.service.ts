import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { User } from '../../../../generated/prisma/client';
import { AttendeeEventFlags } from '../../../events/serializers/event.serializer';
import { EventsService } from '../../../events/events.service';

@Injectable()
export class EventDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async findForViewer(slug: string, viewer: User) {
    const event = await this.events.findVisibleDetailBySlug(slug);

    const [subscription, rsvp, interestOverlap] = await Promise.all([
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
    ]);

    const flags: AttendeeEventFlags = {
      isSubscribed: subscription !== null,
      isRsvped: rsvp !== null,
      isMuted: false,
      interestOverlap,
    };

    return { event, flags };
  }
}
