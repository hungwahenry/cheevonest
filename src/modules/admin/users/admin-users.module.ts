import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUserSerializer } from './serializers/admin-user.serializer';
import { AdminUsersService } from './services/admin-users.service';
import { UserModerationService } from './services/user-moderation.service';

@Module({
  imports: [UsersModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, UserModerationService, AdminUserSerializer],
})
export class AdminUsersModule {}
