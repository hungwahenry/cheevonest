import { Module } from '@nestjs/common';
import { OrganisationSerializer } from './organisation.serializer';
import { OrganisationsPolicy } from './organisations.policy';
import { OrganisationsService } from './organisations.service';

@Module({
  providers: [
    OrganisationsService,
    OrganisationsPolicy,
    OrganisationSerializer,
  ],
  exports: [OrganisationsService, OrganisationsPolicy, OrganisationSerializer],
})
export class OrganisationsModule {}
