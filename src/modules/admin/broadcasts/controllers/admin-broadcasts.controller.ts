import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { ListBroadcastsDto } from '../dto/admin-broadcasts.dto';
import { AdminBroadcastSerializer } from '../serializers/admin-broadcast.serializer';
import { BroadcastModerationService } from '../services/broadcast-moderation.service';

@Roles('admin')
@Controller('admin/broadcasts')
export class AdminBroadcastsController {
  constructor(
    private readonly broadcasts: BroadcastModerationService,
    private readonly serializer: AdminBroadcastSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListBroadcastsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.broadcasts.page({
      page,
      perPage,
      status: dto.status,
    });

    return new Paginated(
      result.items.map((broadcast) => this.serializer.row(broadcast)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.detail(await this.broadcasts.detail(id));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @AuditAction('broadcasts.cancel')
  async cancel(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    await this.broadcasts.cancel(id);

    audit({ targetType: 'broadcast', targetId: id });

    return new ApiResult(
      await this.serializer.detail(await this.broadcasts.detail(id)),
      'Broadcast cancelled.',
    );
  }
}
