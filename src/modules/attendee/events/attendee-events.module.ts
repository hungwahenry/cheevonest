import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { EventDetailController } from './controllers/event-detail.controller';
import { RsvpController } from './controllers/rsvp.controller';
import { EventDetailService } from './services/event-detail.service';
import { RsvpService } from './services/rsvp.service';

@Module({
  imports: [EventsModule, NotificationsModule],
  controllers: [EventDetailController, RsvpController],
  providers: [RsvpService, EventDetailService],
})
export class AttendeeEventsModule {}
