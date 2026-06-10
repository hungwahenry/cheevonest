import { Module } from '@nestjs/common';
import { BroadcastsModule } from '../../broadcasts/broadcasts.module';
import { EventsModule } from '../../events/events.module';
import { OrganizerBroadcastsController } from './broadcasts.controller';

@Module({
  imports: [BroadcastsModule, EventsModule],
  controllers: [OrganizerBroadcastsController],
})
export class OrganizerBroadcastsModule {}
