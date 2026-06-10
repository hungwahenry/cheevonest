import { Module } from '@nestjs/common';
import { TicketSerializer } from './serializers/ticket.serializer';
import { IssuedTicketsService } from './services/issued-tickets.service';
import { TicketListingService } from './services/ticket-listing.service';

@Module({
  providers: [IssuedTicketsService, TicketListingService, TicketSerializer],
  exports: [IssuedTicketsService, TicketListingService, TicketSerializer],
})
export class TicketsModule {}
