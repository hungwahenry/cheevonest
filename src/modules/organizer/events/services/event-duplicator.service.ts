import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import {
  EventForResource,
  EventsService,
} from '../../../events/events.service';
import { EventManagerService } from './event-manager.service';

/**
 * Clones an event back to draft. Dates and counters reset; uploaded media stays
 * on the original — duplicating storage would risk shared deletes.
 */
@Injectable()
export class EventDuplicatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly manager: EventManagerService,
  ) {}

  async duplicate(source: Event): Promise<EventForResource> {
    const loaded = await this.events.loadForResource(source.id);
    const title = `Copy of ${source.title}`;
    const cloneId = ulid();

    await this.prisma.$transaction(async (tx) => {
      await tx.event.create({
        data: {
          id: cloneId,
          organisationId: loaded.organisationId,
          title,
          slug: await this.manager.uniqueSlug(title),
          description: loaded.description,
          timezone: loaded.timezone,
          venueName: loaded.venueName,
          placeId: loaded.placeId,
          address: loaded.address,
          latitude: loaded.latitude,
          longitude: loaded.longitude,
          city: loaded.city,
          currency: loaded.currency,
          videoUrl: loaded.videoUrl,
        },
      });

      await tx.organisation.update({
        where: { id: loaded.organisationId },
        data: { eventsCount: { increment: 1 } },
      });

      if (loaded.tickets.length > 0) {
        await tx.eventTicket.createMany({
          data: loaded.tickets.map((ticket) => ({
            id: ulid(),
            eventId: cloneId,
            name: ticket.name,
            description: ticket.description,
            grossPrice: ticket.grossPrice,
            displayPrice: ticket.displayPrice,
            quantity: ticket.quantity,
            sortOrder: ticket.sortOrder,
            status: ticket.status,
            salesStartsAt: ticket.salesStartsAt,
            salesEndsAt: ticket.salesEndsAt,
            validFrom: ticket.validFrom,
            validTo: ticket.validTo,
            maxPerOrder: ticket.maxPerOrder,
          })),
        });
      }

      if (loaded.features.length > 0) {
        await tx.eventFeature.createMany({
          data: loaded.features.map((feature) => ({
            id: ulid(),
            eventId: cloneId,
            title: feature.title,
            description: feature.description,
            link: feature.link,
            startsAt: feature.startsAt,
            endsAt: feature.endsAt,
            sortOrder: feature.sortOrder,
          })),
        });
      }

      if (loaded.interests.length > 0) {
        await tx.eventInterest.createMany({
          data: loaded.interests.map(({ interestId }) => ({
            eventId: cloneId,
            interestId,
          })),
        });
      }

      await this.events.recomputeTicketAggregates(cloneId, tx);
    });

    return this.events.loadForResource(cloneId);
  }
}
