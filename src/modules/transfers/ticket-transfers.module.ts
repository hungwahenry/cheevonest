import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { UsersModule } from '../users/users.module';
import { TicketTransfersController } from './controllers/ticket-transfers.controller';
import { TicketTransferRules } from './rules/ticket-transfer.rules';
import { TicketTransferService } from './services/ticket-transfer.service';

@Module({
  imports: [TicketsModule, UsersModule],
  controllers: [TicketTransfersController],
  providers: [TicketTransferService, TicketTransferRules],
})
export class TicketTransfersModule {}
