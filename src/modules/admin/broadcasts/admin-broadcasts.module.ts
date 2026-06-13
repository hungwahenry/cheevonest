import { Module } from '@nestjs/common';
import { AdminBroadcastsController } from './controllers/admin-broadcasts.controller';
import { AdminSuppressionsController } from './controllers/admin-suppressions.controller';
import { AdminBroadcastSerializer } from './serializers/admin-broadcast.serializer';
import { AdminSuppressionsService } from './services/admin-suppressions.service';
import { BroadcastModerationService } from './services/broadcast-moderation.service';

@Module({
  controllers: [AdminBroadcastsController, AdminSuppressionsController],
  providers: [
    BroadcastModerationService,
    AdminSuppressionsService,
    AdminBroadcastSerializer,
  ],
})
export class AdminBroadcastsModule {}
