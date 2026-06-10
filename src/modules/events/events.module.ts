import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../organisations/organisations.module';
import { PublicEventController } from './controllers/public-event.controller';
import { EventsCronsService } from './events-crons.service';
import { EventsPolicy } from './events.policy';
import { EventsService } from './events.service';
import { EventSerializer } from './serializers/event.serializer';

@Module({
  imports: [OrganisationsModule],
  controllers: [PublicEventController],
  providers: [EventsService, EventsPolicy, EventSerializer, EventsCronsService],
  exports: [EventsService, EventsPolicy, EventSerializer],
})
export class EventsModule {}
