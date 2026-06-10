import { Module } from '@nestjs/common';
import { ReportsController } from './controllers/reports.controller';
import { ReportRules } from './rules/report.rules';
import { ReportsService } from './services/reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportRules],
  exports: [ReportsService],
})
export class ReportsModule {}
