import { Module } from '@nestjs/common';
import { LedgerModule } from '../../ledger/ledger.module';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { PayoutsModule } from '../../payouts/payouts.module';
import { AdminOrganisationsController } from './controllers/admin-organisations.controller';
import { AdminOrganisationSerializer } from './serializers/admin-organisation.serializer';
import { AdminOrganisationsService } from './services/admin-organisations.service';
import { OrganisationBalanceService } from './services/organisation-balance.service';
import { OrganisationModerationService } from './services/organisation-moderation.service';

@Module({
  imports: [OrganisationsModule, PayoutsModule, LedgerModule],
  controllers: [AdminOrganisationsController],
  providers: [
    AdminOrganisationsService,
    OrganisationModerationService,
    OrganisationBalanceService,
    AdminOrganisationSerializer,
  ],
})
export class AdminOrganisationsModule {}
