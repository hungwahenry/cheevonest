import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AnalyticsRangeDto } from '../dto/analytics.dto';
import { PlatformAnalyticsService } from '../services/platform-analytics.service';

@Roles('admin')
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analytics: PlatformAnalyticsService) {}

  @Get('overview')
  async overview(): Promise<unknown> {
    return this.analytics.overview();
  }

  @Get('revenue')
  async revenue(@Query() dto: AnalyticsRangeDto): Promise<unknown> {
    return this.analytics.revenue(dto.interval ?? 'day', dto.days ?? 30);
  }

  @Get('payments')
  async payments(@Query() dto: AnalyticsRangeDto): Promise<unknown> {
    return this.analytics.payments(dto.days ?? 30);
  }

  @Get('engagement')
  async engagement(@Query() dto: AnalyticsRangeDto): Promise<unknown> {
    return this.analytics.engagement(dto.days ?? 30);
  }

  @Get('leaderboards')
  async leaderboards(@Query() dto: AnalyticsRangeDto): Promise<unknown> {
    return this.analytics.leaderboards(dto.days ?? 30, dto.limit ?? 5);
  }
}
