import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CreateReportDto, ListReasonsDto } from '../dto/reports.dto';
import { ReportsService } from '../services/reports.service';
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('report-reasons')
  async reasons(@Query() dto: ListReasonsDto): Promise<unknown[]> {
    const reasons = await this.reports.reasonsForTarget(dto.target_type);

    return reasons.map((reason) => ({
      id: reason.id,
      slug: reason.slug,
      label: reason.label,
      description: reason.description,
      requires_details: reason.requiresDetails,
    }));
  }

  @Post('reports')
  @HttpCode(201)
  async create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const report = await this.reports.create(user, dto);

    return new ApiResult({
      id: report.id,
      target_type: report.targetType,
      target_id: report.targetId,
      report_reason_id: report.reportReasonId,
      details: report.details,
      status: report.status,
      created_at: report.createdAt.toISOString(),
    });
  }
}
