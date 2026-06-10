import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [EventsModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
