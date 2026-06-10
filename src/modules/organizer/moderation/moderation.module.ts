import { Module } from '@nestjs/common';
import { CommentsModule } from '../../comments/comments.module';
import { EventsModule } from '../../events/events.module';
import { ModerationController } from './moderation.controller';

@Module({
  imports: [CommentsModule, EventsModule],
  controllers: [ModerationController],
})
export class ModerationModule {}
