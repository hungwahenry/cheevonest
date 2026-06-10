import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { TicketsModule } from '../../tickets/tickets.module';
import { UsersModule } from '../../users/users.module';
import { OrganizerIssuedTicketSerializer } from './issued-ticket.serializer';
import { OrganizerIssuedTicketsController } from './issued-tickets.controller';

@Module({
  imports: [EventsModule, TicketsModule, UsersModule],
  controllers: [OrganizerIssuedTicketsController],
  providers: [OrganizerIssuedTicketSerializer],
})
export class OrganizerTicketsModule {}
