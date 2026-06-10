import { Module } from '@nestjs/common';
import { EventsPolicy } from './events.policy';
import { EventsService } from './events.service';
import { EventSerializer } from './serializers/event.serializer';

@Module({
  providers: [EventsService, EventsPolicy, EventSerializer],
  exports: [EventsService, EventsPolicy, EventSerializer],
})
export class EventsModule {}
