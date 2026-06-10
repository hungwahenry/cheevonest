import { Module } from '@nestjs/common';
import { OrganizerEventsModule } from './events/organizer-events.module';
import { ModerationModule } from './moderation/moderation.module';
import { OrganizerOrganisationsModule } from './organisations/organizer-organisations.module';
import { OrganizerPayoutsModule } from './payouts/organizer-payouts.module';
import { OrganizerTicketsModule } from './tickets/organizer-tickets.module';

@Module({
  imports: [
    OrganizerOrganisationsModule,
    OrganizerEventsModule,
    ModerationModule,
    OrganizerTicketsModule,
    OrganizerPayoutsModule,
  ],
})
export class OrganizerModule {}
