import { Module } from '@nestjs/common';
import { CommentsModule } from '../../comments/comments.module';
import { EventsModule } from '../../events/events.module';
import { AttendeeCommentsController } from './comments.controller';

@Module({
  imports: [CommentsModule, EventsModule],
  controllers: [AttendeeCommentsController],
})
export class AttendeeCommentsModule {}
