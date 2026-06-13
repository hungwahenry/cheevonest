import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { AdminEventsController } from './controllers/admin-events.controller';
import { AdminEventSerializer } from './serializers/admin-event.serializer';
import { AdminEventsService } from './services/admin-events.service';
import { EventModerationService } from './services/event-moderation.service';

@Module({
  imports: [EventsModule],
  controllers: [AdminEventsController],
  providers: [AdminEventsService, EventModerationService, AdminEventSerializer],
})
export class AdminEventsModule {}
