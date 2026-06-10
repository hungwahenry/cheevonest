import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { UsersModule } from '../../users/users.module';
import { CatalogController } from './catalog.controller';
import { MemberSerializer } from './member.serializer';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { OrganisationManagerService } from './organisation-manager.service';
import { OrganisationsController } from './organisations.controller';

@Module({
  imports: [OrganisationsModule, UsersModule],
  controllers: [CatalogController, OrganisationsController, MembersController],
  providers: [OrganisationManagerService, MembersService, MemberSerializer],
})
export class OrganizerOrganisationsModule {}
