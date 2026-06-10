import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ApiResult } from '../../../common/responses/api-result';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import {
  REPORT_TARGET_TYPES,
  ReportsService,
} from '../services/reports.service';

class CreateReportDto {
  @IsString()
  @IsIn(REPORT_TARGET_TYPES)
  target_type!: string;

  @IsString()
  @Length(26, 26)
  target_id!: string;

  @IsString()
  @Length(26, 26)
  report_reason_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string | null;
}

class ListReasonsDto {
  @IsString()
  @IsIn(REPORT_TARGET_TYPES)
  target_type!: string;
}

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
