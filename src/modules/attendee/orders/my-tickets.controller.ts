import { Controller, Get, Param } from '@nestjs/common';

import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { TicketSerializer } from '../../tickets/serializers/ticket.serializer';
import { IssuedTicketsService } from '../../tickets/services/issued-tickets.service';
import { TicketListingService } from '../../tickets/services/ticket-listing.service';

@Controller('attendee/tickets')
export class MyTicketsController {
  constructor(
    private readonly issuedTickets: IssuedTicketsService,
    private readonly listing: TicketListingService,
    private readonly serializer: TicketSerializer,
  ) {}

  @Get(':ticketId')
  async show(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    await this.issuedTickets.findHeldOrFail(ticketId, user.id);

    return this.serializer.myTicket(await this.listing.heldOne(ticketId));
  }
}
