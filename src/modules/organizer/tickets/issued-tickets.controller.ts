import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { EventsPolicy } from '../../events/events.policy';
import { EventsService } from '../../events/events.service';
import { IssuedTicketsService } from '../../tickets/services/issued-tickets.service';
import { TicketListingService } from '../../tickets/services/ticket-listing.service';
import { OrganizerIssuedTicketSerializer } from './issued-ticket.serializer';
import { ListIssuedTicketsDto, ScanTicketDto } from './dto/issued-tickets.dto';

@Controller('organizer/events/:eventId/issued-tickets')
export class OrganizerIssuedTicketsController {
  constructor(
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly issuedTickets: IssuedTicketsService,
    private readonly listing: TicketListingService,
    private readonly serializer: OrganizerIssuedTicketSerializer,
  ) {}

  @Get()
  async list(
    @Param('eventId') eventId: string,
    @Query() dto: ListIssuedTicketsDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.listing.forEvent(event.id, {
      page,
      perPage,
      status: dto.status,
      search: dto.q,
    });

    return new Paginated(
      result.items.map((ticket) => this.serializer.issuedTicket(ticket)),
      page,
      perPage,
      result.total,
    );
  }

  @Get('summary')
  async summary(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    return this.listing.checkInSummary(event.id);
  }

  @Get(':ticketId')
  async show(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);
    await this.issuedTickets.findScoped(event.id, ticketId);

    return this.serializer.issuedTicket(
      await this.listing.forEventOne(ticketId),
    );
  }

  @Post('scan')
  @HttpCode(200)
  async scan(
    @Param('eventId') eventId: string,
    @Body() dto: ScanTicketDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const ticket = await this.issuedTickets.scanByCode(event, dto.code, user);

    return new ApiResult(
      this.serializer.issuedTicket(await this.listing.forEventOne(ticket.id)),
      'Ticket scanned.',
    );
  }

  @Post(':ticketId/revoke')
  @HttpCode(200)
  async revoke(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);
    await this.issuedTickets.findScoped(event.id, ticketId);

    const ticket = await this.issuedTickets.revoke(ticketId);

    return new ApiResult(
      this.serializer.issuedTicket(await this.listing.forEventOne(ticket.id)),
      'Ticket revoked.',
    );
  }
}
