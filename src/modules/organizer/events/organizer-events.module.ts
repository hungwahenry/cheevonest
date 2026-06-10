import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { EventsController } from './controllers/events.controller';
import { FeaturesController } from './controllers/features.controller';
import { ImagesController } from './controllers/images.controller';
import { TicketsController } from './controllers/tickets.controller';
import { EventInterestRules } from './rules/event-interests.rules';
import { PublishRules } from './rules/publish.rules';
import { EventDuplicatorService } from './services/event-duplicator.service';
import { EventManagerService } from './services/event-manager.service';
import { EventMediaService } from './services/event-media.service';
import { EventPublisherService } from './services/event-publisher.service';
import { TicketsService } from './services/tickets.service';

@Module({
  imports: [EventsModule],
  controllers: [
    EventsController,
    ImagesController,
    FeaturesController,
    TicketsController,
  ],
  providers: [
    EventManagerService,
    EventPublisherService,
    EventDuplicatorService,
    EventMediaService,
    TicketsService,
    EventInterestRules,
    PublishRules,
  ],
})
export class OrganizerEventsModule {}
