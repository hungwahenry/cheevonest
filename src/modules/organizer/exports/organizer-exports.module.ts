import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { OrganizerExportsController } from './exports.controller';
import { EventExportsService } from './services/event-exports.service';

@Module({
  imports: [EventsModule],
  controllers: [OrganizerExportsController],
  providers: [EventExportsService],
})
export class OrganizerExportsModule {}
