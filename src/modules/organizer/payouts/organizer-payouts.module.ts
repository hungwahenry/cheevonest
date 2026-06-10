import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { PayoutsModule } from '../../payouts/payouts.module';
import { BanksController } from './banks.controller';
import { OrganizerPayoutsController } from './payouts.controller';

@Module({
  imports: [OrganisationsModule, PayoutsModule],
  controllers: [BanksController, OrganizerPayoutsController],
})
export class OrganizerPayoutsModule {}
