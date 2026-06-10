import { Module } from '@nestjs/common';
import { UserSerializer } from './serializers/user.serializer';
import { UsersService } from './services/users.service';

@Module({
  providers: [UsersService, UserSerializer],
  exports: [UsersService, UserSerializer],
})
export class UsersModule {}
