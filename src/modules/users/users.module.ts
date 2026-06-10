import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { OrganisationsModule } from '../organisations/organisations.module';
import { PublicUsersController } from './controllers/public-users.controller';
import { UsernameRules } from './rules/username.rules';
import { UserSerializer } from './serializers/user.serializer';
import { PublicProfileService } from './services/public-profile.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [OrganisationsModule, EventsModule],
  controllers: [PublicUsersController],
  providers: [
    UsersService,
    PublicProfileService,
    UserSerializer,
    UsernameRules,
  ],
  exports: [UsersService, PublicProfileService, UserSerializer, UsernameRules],
})
export class UsersModule {}
