import { Controller, Get, Param, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Paginated } from '../../../common/responses/paginated';
import { toNumber } from '../../../common/validation/transforms';
import type {
  IssuedTicketStatus,
  User,
} from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { TicketSerializer } from '../../tickets/serializers/ticket.serializer';
import { IssuedTicketsService } from '../../tickets/services/issued-tickets.service';
import { TicketListingService } from '../../tickets/services/ticket-listing.service';

class ListMyTicketsDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  per_page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsIn(['valid', 'scanned', 'revoked'])
  status?: IssuedTicketStatus;
}

@Controller('attendee/tickets')
export class MyTicketsController {
  constructor(
    private readonly issuedTickets: IssuedTicketsService,
    private readonly listing: TicketListingService,
    private readonly serializer: TicketSerializer,
  ) {}

  @Get()
  async list(
    @Query() dto: ListMyTicketsDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 30, 100);

    const result = await this.listing.heldBy(user.id, {
      page,
      perPage,
      status: dto.status,
    });

    return new Paginated(
      result.items.map((ticket) => this.serializer.myTicket(ticket)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':ticketId')
  async show(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    await this.issuedTickets.findHeldOrFail(ticketId, user.id);

    return this.serializer.myTicket(await this.listing.heldOne(ticketId));
  }
}
