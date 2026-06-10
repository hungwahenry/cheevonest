import { Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventsService } from '../../../events/events.service';
import { RsvpService } from '../services/rsvp.service';

@Controller('attendee/events/:eventId/rsvp')
export class RsvpController {
  constructor(
    private readonly events: EventsService,
    private readonly rsvps: RsvpService,
  ) {}

  @Post()
  @HttpCode(200)
  async rsvp(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);

    await this.rsvps.rsvp(user, event);

    return new ApiResult(
      {
        is_rsvped: true,
        rsvps_count: await this.rsvps.rsvpsCount(event.id),
      },
      "You're going.",
    );
  }

  @Delete()
  @HttpCode(200)
  async unrsvp(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);

    await this.rsvps.unrsvp(user, event);

    return new ApiResult(
      {
        is_rsvped: false,
        rsvps_count: await this.rsvps.rsvpsCount(event.id),
      },
      'No longer going.',
    );
  }
}
