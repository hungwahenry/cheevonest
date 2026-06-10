import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../organisations/organisations.module';
import { UserSerializer } from './serializers/user.serializer';
import { UsersService } from './services/users.service';

@Module({
  imports: [OrganisationsModule],
  providers: [UsersService, UserSerializer],
  exports: [UsersService, UserSerializer],
})
export class UsersModule {}
