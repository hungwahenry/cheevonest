import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { CurrentUser, Roles } from '../../../auth/decorators/auth.decorators';
import type { User } from '../../../../generated/prisma/client';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import {
  CreateBroadcastDto,
  ListBroadcastsDto,
  PreviewBroadcastDto,
  ScheduleBroadcastDto,
  toSegment,
  UpdateBroadcastDto,
} from '../dto/admin-broadcast.dto';
import { AdminBroadcastSerializer } from '../serializers/admin-broadcast.serializer';
import { AdminBroadcastService } from '../services/admin-broadcast.service';

@Roles('admin')
@Controller('admin/announcements')
export class AdminBroadcastsController {
  constructor(
    private readonly broadcasts: AdminBroadcastService,
    private readonly serializer: AdminBroadcastSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListBroadcastsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.broadcasts.page({
      page,
      perPage,
      kind: dto.kind,
      status: dto.status,
    });

    return new Paginated(
      result.items.map((broadcast) => this.serializer.row(broadcast)),
      page,
      perPage,
      result.total,
    );
  }

  @Post('preview')
  @HttpCode(200)
  async preview(@Body() dto: PreviewBroadcastDto): Promise<unknown> {
    const recipients = await this.broadcasts.preview(
      toSegment(dto.audience),
      dto.kind,
    );

    return { recipients };
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.detail(await this.broadcasts.detail(id));
  }

  @Post()
  @AuditAction('announcements.create')
  async create(
    @CurrentUser() admin: User,
    @Body() dto: CreateBroadcastDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const broadcast = await this.broadcasts.create(admin.id, {
      kind: dto.kind,
      title: dto.title,
      body: dto.body,
      channels: dto.channels,
      audience: toSegment(dto.audience),
    });

    audit({ targetType: 'admin_broadcast', targetId: broadcast.id });

    return new ApiResult(
      this.serializer.detail(await this.broadcasts.detail(broadcast.id)),
      'Broadcast created.',
    );
  }

  @Patch(':id')
  @AuditAction('announcements.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBroadcastDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    await this.broadcasts.update(id, {
      kind: dto.kind,
      title: dto.title,
      body: dto.body,
      channels: dto.channels,
      audience: toSegment(dto.audience),
    });

    audit({ targetType: 'admin_broadcast', targetId: id });

    return new ApiResult(
      this.serializer.detail(await this.broadcasts.detail(id)),
      'Broadcast updated.',
    );
  }

  @Delete(':id')
  @AuditAction('announcements.delete')
  async remove(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    await this.broadcasts.remove(id);

    audit({ targetType: 'admin_broadcast', targetId: id });

    return new ApiResult(null, 'Broadcast deleted.');
  }

  @Post(':id/send')
  @HttpCode(200)
  @AuditAction('announcements.send')
  async send(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const broadcast = await this.broadcasts.send(id);

    audit({
      targetType: 'admin_broadcast',
      targetId: id,
      payload: {
        recipients: broadcast.recipientsCount,
        status: broadcast.status,
      },
    });

    return new ApiResult(
      this.serializer.detail(await this.broadcasts.detail(id)),
      'Broadcast sent.',
    );
  }

  @Post(':id/schedule')
  @HttpCode(200)
  @AuditAction('announcements.schedule')
  async schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleBroadcastDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    await this.broadcasts.schedule(id, new Date(dto.scheduled_at));

    audit({
      targetType: 'admin_broadcast',
      targetId: id,
      payload: { scheduled_at: dto.scheduled_at },
    });

    return new ApiResult(
      this.serializer.detail(await this.broadcasts.detail(id)),
      'Broadcast scheduled.',
    );
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @AuditAction('announcements.cancel')
  async cancel(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    await this.broadcasts.cancel(id);

    audit({ targetType: 'admin_broadcast', targetId: id });

    return new ApiResult(
      this.serializer.detail(await this.broadcasts.detail(id)),
      'Broadcast cancelled.',
    );
  }
}
