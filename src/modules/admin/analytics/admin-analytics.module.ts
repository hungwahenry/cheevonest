import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { PlatformAnalyticsService } from './services/platform-analytics.service';

@Module({
  controllers: [AdminAnalyticsController],
  providers: [PlatformAnalyticsService],
})
export class AdminAnalyticsModule {}
