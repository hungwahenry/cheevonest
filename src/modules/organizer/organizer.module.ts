import { Module } from '@nestjs/common';
import { OrganizerEventsModule } from './events/organizer-events.module';
import { ModerationModule } from './moderation/moderation.module';
import { OrganizerOrganisationsModule } from './organisations/organizer-organisations.module';

@Module({
  imports: [
    OrganizerOrganisationsModule,
    OrganizerEventsModule,
    ModerationModule,
  ],
})
export class OrganizerModule {}
