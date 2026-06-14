import { Module } from '@nestjs/common';
import { AdminAnalyticsModule } from './analytics/admin-analytics.module';
import { AdminAnnouncementsModule } from './announcements/admin-announcements.module';
import { AdminBroadcastsModule } from './broadcasts/admin-broadcasts.module';
import { AdminCatalogsModule } from './catalogs/admin-catalogs.module';
import { AdminContentModule } from './content/admin-content.module';
import { AdminSettingsModule } from './settings/admin-settings.module';
import { AdminCommentsModule } from './comments/admin-comments.module';
import { AdminReportsModule } from './reports/admin-reports.module';
import { AdminEventsModule } from './events/admin-events.module';
import { AdminOpsModule } from './ops/admin-ops.module';
import { AdminIssuedTicketsModule } from './issued-tickets/admin-issued-tickets.module';
import { AdminOrdersModule } from './orders/admin-orders.module';
import { AdminPaymentsModule } from './payments/admin-payments.module';
import { AdminOrganisationsModule } from './organisations/admin-organisations.module';
import { AdminPayoutsModule } from './payouts/admin-payouts.module';
import { AdminUsersModule } from './users/admin-users.module';

@Module({
  imports: [
    AdminPayoutsModule,
    AdminUsersModule,
    AdminOrganisationsModule,
    AdminEventsModule,
    AdminOrdersModule,
    AdminPaymentsModule,
    AdminIssuedTicketsModule,
    AdminCommentsModule,
    AdminReportsModule,
    AdminBroadcastsModule,
    AdminCatalogsModule,
    AdminContentModule,
    AdminSettingsModule,
    AdminAnalyticsModule,
    AdminOpsModule,
    AdminAnnouncementsModule,
  ],
})
export class AdminModule {}
