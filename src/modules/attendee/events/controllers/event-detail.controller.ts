import { Controller, Get, Param } from '@nestjs/common';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventSerializer } from '../../../events/serializers/event.serializer';
import { EventDetailService } from '../services/event-detail.service';

@Controller('attendee/events')
export class EventDetailController {
  constructor(
    private readonly detail: EventDetailService,
    private readonly serializer: EventSerializer,
  ) {}

  @Get(':slug')
  async show(
    @Param('slug') slug: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const { event, flags } = await this.detail.findForViewer(slug, user);

    return this.serializer.attendeeDetail(event, flags);
  }
}
