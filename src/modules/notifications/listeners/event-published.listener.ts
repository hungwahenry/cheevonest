import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  EVENT_PUBLISHED,
  EventPublishedEvent,
} from '../../events/events/event-published.event';
import { NewEventFromSubscriptionMessage } from '../messages';
import { NotifierService } from '../services/notifier.service';

const MAX_FANOUTS_PER_DAY = 3;

@Injectable()
export class EventPublishedListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
  ) {}

  @OnEvent(EVENT_PUBLISHED, { promisify: true })
  async handle(event: EventPublishedEvent): Promise<void> {
    const published = await this.prisma.event.findUnique({
      where: { id: event.eventId },
      include: { organisation: true },
    });

    if (!published) {
      return;
    }

    if (!(await this.claimFanoutSlot(published.organisationId))) {
      return;
    }

    const subscribers = await this.prisma.subscription.findMany({
      where: { organisationId: published.organisationId },
      select: { userId: true },
    });

    await this.notifier.send(
      subscribers.map((row) => row.userId),
      new NewEventFromSubscriptionMessage(published),
    );
  }

  /** Caps subscription fanouts at 3 per org per rolling day so bulk edits don't spam followers. */
  private async claimFanoutSlot(organisationId: string): Promise<boolean> {
    const windowFloor = new Date(Date.now() - 86_400_000);

    const reset = await this.prisma.organisation.updateMany({
      where: {
        id: organisationId,
        OR: [
          { subscriptionFanoutWindowStartedAt: null },
          { subscriptionFanoutWindowStartedAt: { lt: windowFloor } },
        ],
      },
      data: {
        subscriptionFanoutWindowStartedAt: new Date(),
        subscriptionFanoutCount: 1,
      },
    });

    if (reset.count > 0) {
      return true;
    }

    const incremented = await this.prisma.organisation.updateMany({
      where: {
        id: organisationId,
        subscriptionFanoutCount: { lt: MAX_FANOUTS_PER_DAY },
      },
      data: { subscriptionFanoutCount: { increment: 1 } },
    });

    return incremented.count > 0;
  }
}
