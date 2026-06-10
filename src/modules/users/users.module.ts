import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../organisations/organisations.module';
import { UsernameRules } from './rules/username.rules';
import { UserSerializer } from './serializers/user.serializer';
import { UsersService } from './services/users.service';

@Module({
  imports: [OrganisationsModule],
  providers: [UsersService, UserSerializer, UsernameRules],
  exports: [UsersService, UserSerializer, UsernameRules],
})
export class UsersModule {}
