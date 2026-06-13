import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { AdminOrganisationsController } from './controllers/admin-organisations.controller';
import { AdminOrganisationSerializer } from './serializers/admin-organisation.serializer';
import { AdminOrganisationsService } from './services/admin-organisations.service';
import { OrganisationModerationService } from './services/organisation-moderation.service';

@Module({
  imports: [OrganisationsModule],
  controllers: [AdminOrganisationsController],
  providers: [
    AdminOrganisationsService,
    OrganisationModerationService,
    AdminOrganisationSerializer,
  ],
})
export class AdminOrganisationsModule {}
