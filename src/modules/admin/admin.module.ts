import { Module } from '@nestjs/common';
import { AdminBroadcastsModule } from './broadcasts/admin-broadcasts.module';
import { AdminCommentsModule } from './comments/admin-comments.module';
import { AdminReportsModule } from './reports/admin-reports.module';
import { AdminEventsModule } from './events/admin-events.module';
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
  ],
})
export class AdminModule {}
