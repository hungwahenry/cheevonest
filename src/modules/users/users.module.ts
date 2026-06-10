import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { OrganisationsModule } from '../organisations/organisations.module';
import { PublicUsersController } from './controllers/public-users.controller';
import { UsernameRules } from './rules/username.rules';
import { UserSerializer } from './serializers/user.serializer';
import { UsersService } from './services/users.service';

@Module({
  imports: [OrganisationsModule, EventsModule],
  controllers: [PublicUsersController],
  providers: [UsersService, UserSerializer, UsernameRules],
  exports: [UsersService, UserSerializer, UsernameRules],
})
export class UsersModule {}
