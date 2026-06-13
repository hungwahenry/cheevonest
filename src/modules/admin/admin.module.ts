import { Module } from '@nestjs/common';
import { AdminEventsModule } from './events/admin-events.module';
import { AdminOrganisationsModule } from './organisations/admin-organisations.module';
import { AdminPayoutsModule } from './payouts/admin-payouts.module';
import { AdminUsersModule } from './users/admin-users.module';

@Module({
  imports: [
    AdminPayoutsModule,
    AdminUsersModule,
    AdminOrganisationsModule,
    AdminEventsModule,
  ],
})
export class AdminModule {}
