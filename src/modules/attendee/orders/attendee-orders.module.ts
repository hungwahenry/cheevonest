import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { OrdersModule } from '../../orders/orders.module';
import { TicketsModule } from '../../tickets/tickets.module';
import { MyTicketEventsController } from './my-ticket-events.controller';
import { MyTicketsController } from './my-tickets.controller';
import { AttendeeOrdersController } from './orders.controller';

@Module({
  imports: [EventsModule, OrdersModule, TicketsModule],
  controllers: [
    AttendeeOrdersController,
    MyTicketsController,
    MyTicketEventsController,
  ],
})
export class AttendeeOrdersModule {}
