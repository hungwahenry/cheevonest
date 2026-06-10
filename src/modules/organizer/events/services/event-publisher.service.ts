import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import {
  EventForResource,
  EventsService,
} from '../../../events/events.service';
import { PublishRules } from '../rules/publish.rules';

@Injectable()
export class EventPublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly rules: PublishRules,
  ) {}

  async publish(event: Event): Promise<EventForResource> {
    const loaded = await this.events.loadForResource(event.id);

    this.rules.ensurePublishable(loaded);

    await this.prisma.event.update({
      where: { id: event.id },
      data: { status: 'published', publishedAt: new Date() },
    });

    return this.events.loadForResource(event.id);
  }
}
