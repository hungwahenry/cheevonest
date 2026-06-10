import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Event } from '../../../generated/prisma/client';
import { EventNotOpenForSalesException } from '../exceptions/event-not-open-for-sales.exception';
import { PresaleAccessRequiredException } from '../exceptions/presale-access-required.exception';

@Injectable()
export class OrderWindowRules {
  constructor(private readonly prisma: PrismaService) {}

  ensureEventOpenForSales(event: Event): void {
    const ended =
      event.status === 'past' ||
      (event.endsAt !== null && event.endsAt <= new Date());

    if (ended) {
      throw EventNotOpenForSalesException.ended();
    }

    if (event.status !== 'published') {
      throw EventNotOpenForSalesException.notPublished();
    }
  }

  async ensurePresaleAccess(event: Event, userId: string): Promise<void> {
    const inPresale =
      event.presaleUntil !== null && event.presaleUntil > new Date();

    if (!inPresale) {
      return;
    }

    const rsvp = await this.prisma.eventRsvp.findUnique({
      where: { userId_eventId: { userId, eventId: event.id } },
      select: { userId: true },
    });

    if (!rsvp) {
      throw new PresaleAccessRequiredException(
        event.presaleUntil!.toISOString(),
      );
    }
  }
}
