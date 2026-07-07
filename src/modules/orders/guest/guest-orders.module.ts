import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { UsersModule } from '../../users/users.module';
import { OrdersModule } from '../orders.module';
import { GuestOrdersController } from './guest-orders.controller';
import { GuestOrdersService } from './guest-orders.service';

@Module({
  imports: [OrdersModule, EventsModule, UsersModule],
  controllers: [GuestOrdersController],
  providers: [GuestOrdersService],
})
export class GuestOrdersModule {}
