import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { OrdersModule } from '../../orders/orders.module';
import { SearchModule } from '../../search/search.module';
import { OpsController } from './controllers/ops.controller';
import { PingController } from './controllers/ping.controller';
import { MaintenanceService } from './services/maintenance.service';
import { SystemHealthService } from './services/system-health.service';

@Module({
  imports: [OrdersModule, EventsModule, NotificationsModule, SearchModule],
  controllers: [OpsController, PingController],
  providers: [MaintenanceService, SystemHealthService],
})
export class AdminOpsModule {}
