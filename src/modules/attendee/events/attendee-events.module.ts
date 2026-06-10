import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { EventDetailController } from './controllers/event-detail.controller';
import { RsvpController } from './controllers/rsvp.controller';
import { RsvpService } from './services/rsvp.service';

@Module({
  imports: [EventsModule],
  controllers: [EventDetailController, RsvpController],
  providers: [RsvpService],
})
export class AttendeeEventsModule {}
