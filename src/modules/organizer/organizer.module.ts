import { Module } from '@nestjs/common';
import { OrganizerEventsModule } from './events/organizer-events.module';
import { OrganizerOrganisationsModule } from './organisations/organizer-organisations.module';

@Module({
  imports: [OrganizerOrganisationsModule, OrganizerEventsModule],
})
export class OrganizerModule {}
