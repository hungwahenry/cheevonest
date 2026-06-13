import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { ListSuppressionsDto } from '../dto/admin-broadcasts.dto';
import { AdminBroadcastSerializer } from '../serializers/admin-broadcast.serializer';
import { AdminSuppressionsService } from '../services/admin-suppressions.service';

@Roles('admin')
@Controller('admin/broadcast-suppressions')
export class AdminSuppressionsController {
  constructor(
    private readonly suppressions: AdminSuppressionsService,
    private readonly serializer: AdminBroadcastSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListSuppressionsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.suppressions.page({
      page,
      perPage,
      search: dto.q,
      reason: dto.reason,
    });

    return new Paginated(
      result.items.map((suppression) =>
        this.serializer.suppression(suppression),
      ),
      page,
      perPage,
      result.total,
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('broadcast_suppressions.delete')
  async remove(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    const suppression = await this.suppressions.delete(id);

    audit({
      targetType: 'broadcast_suppression',
      targetId: suppression.id,
      payload: { email: suppression.email, reason: suppression.reason },
    });

    return new ApiResult(null, 'Suppression removed.');
  }
}
