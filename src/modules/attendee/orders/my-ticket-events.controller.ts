import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';

import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';

import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { TicketSerializer } from '../../tickets/serializers/ticket.serializer';
import { TicketListingService } from '../../tickets/services/ticket-listing.service';
import { ListTicketEventsDto } from './dto/list-ticket-events.dto';

@Controller('attendee/ticket-events')
export class MyTicketEventsController {
  constructor(
    private readonly listing: TicketListingService,
    private readonly serializer: TicketSerializer,
  ) {}

  @Get()
  async list(
    @Query() dto: ListTicketEventsDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 30, 100);

    const result = await this.listing.eventsHeldBy(user.id, {
      page,
      perPage,
      when: dto.when,
    });

    return new Paginated(
      result.items.map((row) =>
        this.serializer.ticketEvent(row.event, row.counts),
      ),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':eventId/tickets')
  async tickets(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const tickets = await this.listing.heldForEvent(user.id, eventId);

    if (tickets.length === 0) {
      throw new NotFoundException();
    }

    return new ApiResult(tickets.map((ticket) => this.serializer.myTicket(ticket)));
  }
}
