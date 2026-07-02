import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../auth/decorators/auth.decorators';
import { EventsService } from '../events.service';
import { EventSerializer } from '../serializers/event.serializer';

@Public()
@Controller('events')
export class PublicEventController {
  constructor(
    private readonly events: EventsService,
    private readonly serializer: EventSerializer,
  ) {}

  @Get()
  async index(): Promise<unknown> {
    const events = await this.events.listPublicSitemap();
    return events.map((event) => ({
      slug: event.slug,
      updated_at: event.updatedAt.toISOString(),
    }));
  }

  @Get(':slug')
  async show(@Param('slug') slug: string): Promise<unknown> {
    return this.serializer.publicPage(
      await this.events.findPublicPageBySlug(slug),
    );
  }
}
