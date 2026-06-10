import { Module } from '@nestjs/common';
import { OrganizerEventsModule } from './events/organizer-events.module';
import { ModerationModule } from './moderation/moderation.module';
import { OrganizerOrganisationsModule } from './organisations/organizer-organisations.module';
import { OrganizerAnalyticsModule } from './analytics/organizer-analytics.module';
import { OrganizerBroadcastsModule } from './broadcasts/organizer-broadcasts.module';
import { OrganizerExportsModule } from './exports/organizer-exports.module';
import { OrganizerPayoutsModule } from './payouts/organizer-payouts.module';
import { OrganizerTicketsModule } from './tickets/organizer-tickets.module';

@Module({
  imports: [
    OrganizerOrganisationsModule,
    OrganizerEventsModule,
    ModerationModule,
    OrganizerTicketsModule,
    OrganizerPayoutsModule,
    OrganizerBroadcastsModule,
    OrganizerAnalyticsModule,
    OrganizerExportsModule,
  ],
})
export class OrganizerModule {}
