import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../../common/exceptions/api.exception';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event, User } from '../../../../generated/prisma/client';
import { FeatureFlagsService } from '../../../platform/system-config/feature-flags.service';
import { ensureOpenForRsvp } from '../rules/rsvp.rules';

@Injectable()
export class RsvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureFlagsService,
  ) {}

  async rsvp(user: User, event: Event): Promise<void> {
    if (!(await this.features.enabled('rsvp.enabled', { userId: user.id }))) {
      throw new ValidationFailedException({
        event: ['RSVPs are temporarily disabled.'],
      });
    }

    ensureOpenForRsvp(event);

    const existing = await this.prisma.eventRsvp.findUnique({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
    });

    if (existing) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.eventRsvp.create({
        data: { userId: user.id, eventId: event.id },
      }),
      this.prisma.event.update({
        where: { id: event.id },
        data: { rsvpsCount: { increment: 1 } },
      }),
    ]);
  }

  async unrsvp(user: User, event: Event): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.eventRsvp.deleteMany({
        where: { userId: user.id, eventId: event.id },
      });

      if (deleted.count > 0) {
        await tx.event.update({
          where: { id: event.id },
          data: { rsvpsCount: { decrement: 1 } },
        });
      }
    });
  }

  async rsvpsCount(eventId: string): Promise<number> {
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { rsvpsCount: true },
    });

    return event.rsvpsCount;
  }
}
