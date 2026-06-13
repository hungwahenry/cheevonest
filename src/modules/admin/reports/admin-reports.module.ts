import { Module } from '@nestjs/common';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { AdminReportSerializer } from './serializers/admin-report.serializer';
import { AdminReportsService } from './services/admin-reports.service';
import { ReportModerationService } from './services/report-moderation.service';

@Module({
  controllers: [AdminReportsController],
  providers: [
    AdminReportsService,
    ReportModerationService,
    AdminReportSerializer,
  ],
})
export class AdminReportsModule {}
