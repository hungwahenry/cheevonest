import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EVENT_RESOURCE_INCLUDE } from '../../../events/events.service';
import { EventSerializer } from '../../../events/serializers/event.serializer';
import { ORGANISATION_RESOURCE_INCLUDE } from '../../../organisations/organisations.service';

@Controller('attendee/events')
export class EventDetailController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: EventSerializer,
  ) {}

  @Get(':slug')
  async show(
    @Param('slug') slug: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: { in: ['published', 'past'] } },
      include: {
        ...EVENT_RESOURCE_INCLUDE,
        organisation: { include: ORGANISATION_RESOURCE_INCLUDE },
      },
    });

    if (!event) {
      throw new NotFoundException();
    }

    const [subscription, rsvp, interestOverlap] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: {
          userId_organisationId: {
            userId: user.id,
            organisationId: event.organisationId,
          },
        },
        select: { userId: true },
      }),
      this.prisma.eventRsvp.findUnique({
        where: { userId_eventId: { userId: user.id, eventId: event.id } },
        select: { userId: true },
      }),
      this.prisma.eventInterest.count({
        where: {
          eventId: event.id,
          interest: { users: { some: { userId: user.id } } },
        },
      }),
    ]);

    return this.serializer.attendeeDetail(event, {
      isSubscribed: subscription !== null,
      isRsvped: rsvp !== null,
      isMuted: false,
      interestOverlap,
    });
  }
}
