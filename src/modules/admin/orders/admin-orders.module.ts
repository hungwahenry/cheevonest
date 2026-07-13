import { Module } from '@nestjs/common';
import { OrdersModule } from '../../orders/orders.module';
import { PaymentsModule } from '../../payments/payments.module';
import { TicketsModule } from '../../tickets/tickets.module';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminOrderSerializer } from './serializers/admin-order.serializer';
import { AdminOrdersService } from './services/admin-orders.service';
import { OrderModerationService } from './services/order-moderation.service';

@Module({
  imports: [OrdersModule, PaymentsModule, TicketsModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService, OrderModerationService, AdminOrderSerializer],
})
export class AdminOrdersModule {}
