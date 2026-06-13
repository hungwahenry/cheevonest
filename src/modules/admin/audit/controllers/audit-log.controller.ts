import { Controller, Get, Query } from '@nestjs/common';

import { Paginated } from '../../../../common/responses/paginated';

import { Roles } from '../../../auth/decorators/auth.decorators';
import { AdminActionSerializer } from '../serializers/admin-action.serializer';
import { AuditLogService } from '../services/audit-log.service';
import { ListAuditLogDto } from '../dto/list-audit-log.dto';

@Roles('admin')
@Controller('admin/audit-log')
export class AuditLogController {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly serializer: AdminActionSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListAuditLogDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 50, 100);

    const result = await this.auditLog.page({
      page,
      perPage,
      action: dto.action,
      adminUserId: dto.admin_user_id,
      targetType: dto.target_type,
      targetId: dto.target_id,
    });

    return new Paginated(
      result.items.map((row) => this.serializer.action(row)),
      page,
      perPage,
      result.total,
    );
  }
}
