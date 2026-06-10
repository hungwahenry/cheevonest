import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import {
  EventForResource,
  EventsService,
} from '../../../events/events.service';
import { SearchIndexerService } from '../../../search/services/search-indexer.service';
import { PublishRules } from '../rules/publish.rules';

@Injectable()
export class EventPublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly rules: PublishRules,
    private readonly searchIndexer: SearchIndexerService,
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

    return published;
  }
}
