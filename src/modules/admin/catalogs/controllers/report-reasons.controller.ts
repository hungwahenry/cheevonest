import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { UpsertReportReasonDto } from '../dto/catalog.dto';
import { CatalogSerializer } from '../serializers/catalog.serializer';
import { CatalogService } from '../services/catalog.service';

@Roles('admin')
@Controller('admin/report-reasons')
export class AdminReportReasonsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly serializer: CatalogSerializer,
  ) {}

  @Get()
  async list(): Promise<unknown[]> {
    return (await this.catalog.reportReasons()).map((r) =>
      this.serializer.reportReason(r),
    );
  }

  @Post()
  @HttpCode(201)
  @AuditAction('report_reasons.create')
  async create(
    @Body() dto: UpsertReportReasonDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const created = await this.catalog.createReportReason({
      slug: dto.slug!,
      label: dto.label!,
      description: dto.description,
      scopeTypes: dto.scope_types,
      requiresDetails: dto.requires_details,
      displayOrder: dto.display_order,
    });
    audit({ targetType: 'report_reason', targetId: created.id });
    return new ApiResult(
      this.serializer.reportReason(created),
      'Report reason created.',
    );
  }

  @Patch(':id')
  @AuditAction('report_reasons.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpsertReportReasonDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    await this.catalog.reportReasonOrFail(id);
    const updated = await this.catalog.updateReportReason(id, {
      slug: dto.slug,
      label: dto.label,
      description: dto.description,
      scopeTypes: dto.scope_types,
      requiresDetails: dto.requires_details,
      displayOrder: dto.display_order,
      isActive: dto.is_active,
    });
    audit({ targetType: 'report_reason', targetId: id });
    return new ApiResult(
      this.serializer.reportReason(updated),
      'Report reason updated.',
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('report_reasons.delete')
  async remove(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    await this.catalog.reportReasonOrFail(id);
    await this.catalog.deleteReportReason(id);
    audit({ targetType: 'report_reason', targetId: id });
    return new ApiResult(null, 'Report reason deleted.');
  }
}
