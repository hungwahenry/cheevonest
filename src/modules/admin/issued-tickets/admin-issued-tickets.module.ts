import { Module } from '@nestjs/common';
import { TicketsModule } from '../../tickets/tickets.module';
import { AdminIssuedTicketsController } from './controllers/admin-issued-tickets.controller';
import { AdminIssuedTicketSerializer } from './serializers/admin-issued-ticket.serializer';
import { AdminIssuedTicketsService } from './services/admin-issued-tickets.service';
import { IssuedTicketModerationService } from './services/issued-ticket-moderation.service';

@Module({
  imports: [TicketsModule],
  controllers: [AdminIssuedTicketsController],
  providers: [
    AdminIssuedTicketsService,
    IssuedTicketModerationService,
    AdminIssuedTicketSerializer,
  ],
})
export class AdminIssuedTicketsModule {}
