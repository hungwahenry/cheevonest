import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { DeleteEventDto, ListEventsDto } from '../dto/admin-events.dto';
import { AdminEventSerializer } from '../serializers/admin-event.serializer';
import { AdminEventsService } from '../services/admin-events.service';
import { EventModerationService } from '../services/event-moderation.service';

@Roles('admin')
@Controller('admin/events')
export class AdminEventsController {
  constructor(
    private readonly events: AdminEventsService,
    private readonly moderation: EventModerationService,
    private readonly serializer: AdminEventSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListEventsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.events.page({
      page,
      perPage,
      search: dto.q,
      status: dto.status,
    });

    return new Paginated(
      result.items.map((event) => this.serializer.row(event)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.detail(await this.events.detail(id));
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @AuditAction('events.unpublish')
  async unpublish(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    const event = await this.moderation.findOrFail(id);
    await this.moderation.unpublish(event);

    audit({ targetType: 'event', targetId: event.id });

    return new ApiResult(null, 'Event unpublished.');
  }

  @Post(':id/mark-past')
  @HttpCode(200)
  @AuditAction('events.mark_past')
  async markPast(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    const event = await this.moderation.findOrFail(id);
    await this.moderation.markPast(event);

    audit({ targetType: 'event', targetId: event.id });

    return new ApiResult(null, 'Event marked past.');
  }

  @Post(':id/lock-comments')
  @HttpCode(200)
  @AuditAction('events.lock_comments')
  async lockComments(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    const event = await this.moderation.findOrFail(id);
    await this.moderation.lockComments(event);

    audit({ targetType: 'event', targetId: event.id });

    return new ApiResult(null, 'Comments locked.');
  }

  @Post(':id/unlock-comments')
  @HttpCode(200)
  @AuditAction('events.unlock_comments')
  async unlockComments(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    const event = await this.moderation.findOrFail(id);
    await this.moderation.unlockComments(event);

    audit({ targetType: 'event', targetId: event.id });

    return new ApiResult(null, 'Comments unlocked.');
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('events.delete')
  async remove(
    @Param('id') id: string,
    @Body() dto: DeleteEventDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    const event = await this.moderation.findOrFail(id);

    audit({
      targetType: 'event',
      targetId: event.id,
      payload: {
        title: event.title,
        slug: event.slug,
        organisation_id: event.organisationId,
      },
      reason: dto.reason,
    });

    await this.moderation.delete(event);

    return new ApiResult(null, 'Event deleted.');
  }
}
