import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import {
  EventForResource,
  EventsService,
} from '../../../events/events.service';
import {
  EVENT_PUBLISHED,
  EventPublishedEvent,
} from '../../../events/events/event-published.event';
import { SearchIndexerService } from '../../../search/services/search-indexer.service';
import { CannotUnpublishWithSalesException } from '../exceptions/cannot-unpublish-with-sales.exception';
import { EventNotPublishedException } from '../exceptions/event-not-published.exception';
import { PublishRules } from '../rules/publish.rules';

@Injectable()
export class EventPublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly rules: PublishRules,
    private readonly searchIndexer: SearchIndexerService,
    private readonly emitter: EventEmitter2,
  ) {}

  async publish(event: Event): Promise<EventForResource> {
    const loaded = await this.events.loadForResource(event.id);

    this.rules.ensurePublishable(loaded);

    await this.prisma.event.update({
      where: { id: event.id },
      data: { status: 'published', publishedAt: new Date() },
    });

    const published = await this.events.loadForResource(event.id);
    await this.searchIndexer.indexEvent(published);
    await this.emitter.emitAsync(
      EVENT_PUBLISHED,
      new EventPublishedEvent(published.id),
    );

    return published;
  }

  async unpublish(event: Event): Promise<EventForResource> {
    if (event.status !== 'published') {
      throw new EventNotPublishedException();
    }

    if (event.ticketsSold > 0) {
      throw new CannotUnpublishWithSalesException();
    }

    await this.prisma.event.update({
      where: { id: event.id },
      data: { status: 'draft', publishedAt: null },
    });

    await this.searchIndexer.deindex('event', event.id);

    return this.events.loadForResource(event.id);
  }
}
