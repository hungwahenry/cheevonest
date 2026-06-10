import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { UsersModule } from '../../users/users.module';
import { CatalogController } from './controllers/catalog.controller';
import { MembersController } from './controllers/members.controller';
import { OrganisationsController } from './controllers/organisations.controller';
import { OrganisationRules } from './rules/organisation.rules';
import { MemberSerializer } from './serializers/member.serializer';
import { MembersService } from './services/members.service';
import { OrganisationManagerService } from './services/organisation-manager.service';

@Module({
  imports: [OrganisationsModule, UsersModule],
  controllers: [CatalogController, OrganisationsController, MembersController],
  providers: [
    OrganisationManagerService,
    MembersService,
    OrganisationRules,
    MemberSerializer,
  ],
})
export class OrganizerOrganisationsModule {}
