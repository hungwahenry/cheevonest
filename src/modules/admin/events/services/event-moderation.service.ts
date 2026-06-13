import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import { EventsService } from '../../../events/events.service';
import { EventAlreadyPastException } from '../exceptions/event-already-past.exception';
import { EventCommentsAlreadyLockedException } from '../exceptions/event-comments-already-locked.exception';
import { EventCommentsNotLockedException } from '../exceptions/event-comments-not-locked.exception';
import { EventNotUnpublishableException } from '../exceptions/event-not-unpublishable.exception';

@Injectable()
export class EventModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async unpublish(event: Event): Promise<Event> {
    if (event.status !== 'published') {
      throw new EventNotUnpublishableException(event.status);
    }

    return this.prisma.event.update({
      where: { id: event.id },
      data: { status: 'draft', publishedAt: null },
    });
  }

  async markPast(event: Event): Promise<Event> {
    if (event.status === 'past') {
      throw new EventAlreadyPastException();
    }

    return this.prisma.event.update({
      where: { id: event.id },
      data: { status: 'past' },
    });
  }

  async lockComments(event: Event): Promise<Event> {
    if (event.commentsLockedAt !== null) {
      throw new EventCommentsAlreadyLockedException();
    }

    return this.prisma.event.update({
      where: { id: event.id },
      data: { commentsLockedAt: new Date() },
    });
  }

  async unlockComments(event: Event): Promise<Event> {
    if (event.commentsLockedAt === null) {
      throw new EventCommentsNotLockedException();
    }

    return this.prisma.event.update({
      where: { id: event.id },
      data: { commentsLockedAt: null },
    });
  }

  /** Admin force-delete — bypasses the organizer's "has sales" guard. */
  async delete(event: Event): Promise<void> {
    await this.events.purge(event);
  }

  async findOrFail(eventId: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException();
    }

    return event;
  }
}
