import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { UsersModule } from '../../users/users.module';
import { PublicOrganisationsController } from './controllers/public-organisations.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  imports: [OrganisationsModule, EventsModule, UsersModule],
  controllers: [SubscriptionsController, PublicOrganisationsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class AttendeeOrganisationsModule {}
