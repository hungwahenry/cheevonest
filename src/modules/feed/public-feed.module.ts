import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PublicFeedController } from './public-feed.controller';
import { PublicFeedService } from './public-feed.service';

@Module({
  imports: [EventsModule],
  controllers: [PublicFeedController],
  providers: [PublicFeedService],
})
export class PublicFeedModule {}
