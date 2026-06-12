import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { OrganisationsModule } from '../organisations/organisations.module';
import { DataExportController } from './controllers/data-export.controller';
import { PublicUsersController } from './controllers/public-users.controller';
import { UsernameRules } from './rules/username.rules';
import { UserSerializer } from './serializers/user.serializer';
import { DataExportService } from './services/data-export.service';
import { PublicProfileService } from './services/public-profile.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [OrganisationsModule, EventsModule],
  controllers: [PublicUsersController, DataExportController],
  providers: [
    UsersService,
    PublicProfileService,
    DataExportService,
    UserSerializer,
    UsernameRules,
  ],
  exports: [UsersService, PublicProfileService, UserSerializer, UsernameRules],
})
export class UsersModule {}
