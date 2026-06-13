import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser, Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import {
  ActionReportDto,
  BulkDismissReportsDto,
  DismissReportDto,
  ListReportsDto,
} from '../dto/admin-reports.dto';
import { AdminReportSerializer } from '../serializers/admin-report.serializer';
import { AdminReportsService } from '../services/admin-reports.service';
import { ReportModerationService } from '../services/report-moderation.service';

@Roles('admin')
@Controller('admin/reports')
export class AdminReportsController {
  constructor(
    private readonly reports: AdminReportsService,
    private readonly moderation: ReportModerationService,
    private readonly serializer: AdminReportSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListReportsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.reports.page({
      page,
      perPage,
      status: dto.status,
      targetType: dto.target_type,
    });

    const rows = await Promise.all(
      result.items.map(async (report) =>
        this.serializer.row(report, await this.reports.resolveTarget(report)),
      ),
    );

    return new Paginated(rows, page, perPage, result.total);
  }

  @Post('bulk-dismiss')
  @HttpCode(200)
  @AuditAction('reports.bulk_dismiss')
  async bulkDismiss(
    @Body() dto: BulkDismissReportsDto,
    @CurrentUser() admin: User,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<{ dismissed: number }>> {
    const dismissed = await this.moderation.bulkDismiss(
      dto.ids,
      admin,
      dto.note,
    );

    audit({
      payload: { ids: dto.ids, dismissed },
      reason: dto.note,
    });

    return new ApiResult({ dismissed });
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.detail(await this.reports.detail(id));
  }

  @Post(':id/start-review')
  @HttpCode(200)
  @AuditAction('reports.start_review')
  async startReview(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const report = await this.moderation.findOrFail(id);
    await this.moderation.startReview(report, admin);

    audit({ targetType: 'report', targetId: report.id });

    return new ApiResult(
      await this.serializer.detail(await this.reports.detail(id)),
    );
  }

  @Post(':id/action')
  @HttpCode(200)
  @AuditAction('reports.action')
  async action(
    @Param('id') id: string,
    @Body() dto: ActionReportDto,
    @CurrentUser() admin: User,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const report = await this.moderation.findOrFail(id);
    await this.moderation.action(
      report,
      admin,
      dto.action,
      dto.resolution_note,
    );

    audit({
      targetType: 'report',
      targetId: report.id,
      payload: { action: dto.action },
      reason: dto.resolution_note,
    });

    return new ApiResult(
      await this.serializer.detail(await this.reports.detail(id)),
    );
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  @AuditAction('reports.dismiss')
  async dismiss(
    @Param('id') id: string,
    @Body() dto: DismissReportDto,
    @CurrentUser() admin: User,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const report = await this.moderation.findOrFail(id);
    await this.moderation.dismiss(report, admin, dto.note);

    audit({ targetType: 'report', targetId: report.id, reason: dto.note });

    return new ApiResult(
      await this.serializer.detail(await this.reports.detail(id)),
    );
  }
}
