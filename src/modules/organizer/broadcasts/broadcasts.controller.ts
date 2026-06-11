import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { BroadcastSerializer } from '../../broadcasts/broadcast.serializer';
import { BroadcastsService } from '../../broadcasts/services/broadcasts.service';
import { EventsPolicy } from '../../events/events.policy';
import { EventsService } from '../../events/events.service';
import { CreateBroadcastDto, ListBroadcastsDto } from './dto/broadcast.dto';

@Controller('organizer/events/:eventId/broadcasts')
export class OrganizerBroadcastsController {
  constructor(
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly broadcasts: BroadcastsService,
    private readonly serializer: BroadcastSerializer,
  ) {}

  @Get()
  async list(
    @Param('eventId') eventId: string,
    @Query() dto: ListBroadcastsDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 20, 50);

    const [result, quota] = await Promise.all([
      this.broadcasts.pageForEvent(event.id, page, perPage),
      this.broadcasts.quota(event),
    ]);

    const paginated = new Paginated(
      result.items.map((broadcast) => this.serializer.broadcast(broadcast)),
      page,
      perPage,
      result.total,
    );

    return new ApiResult(paginated, undefined, {
      quota: {
        used: quota.used,
        limit: quota.limit,
        cooldown_minutes: quota.cooldownMinutes,
        cooldown_until: quota.cooldownUntil?.toISOString() ?? null,
      },
    });
  }

  @Post()
  @HttpCode(201)
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateBroadcastDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const broadcast = await this.broadcasts.create(event, user, dto);

    return new ApiResult(
      this.serializer.broadcast(broadcast),
      'Broadcast queued.',
    );
  }

  @Post('test')
  @HttpCode(200)
  async sendTest(
    @Param('eventId') eventId: string,
    @Body() dto: CreateBroadcastDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    await this.broadcasts.sendTest(event, user, dto);

    return new ApiResult(null, 'Test email sent.');
  }

  @Get(':broadcastId')
  async show(
    @Param('eventId') eventId: string,
    @Param('broadcastId') broadcastId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    return this.serializer.broadcast(
      await this.broadcasts.findScoped(event.id, broadcastId),
    );
  }
}
