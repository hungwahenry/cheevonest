import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventsPolicy } from '../../../events/events.policy';
import { EventsService } from '../../../events/events.service';
import { EventSerializer } from '../../../events/serializers/event.serializer';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { ReorderDto } from '../dto/reorder.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { TicketsService } from '../services/tickets.service';

@Controller('organizer/events/:eventId/tickets')
export class TicketsController {
  constructor(
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly tickets: TicketsService,
    private readonly serializer: EventSerializer,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const ticket = await this.tickets.create(event, dto);

    return new ApiResult(this.serializer.ticket(ticket), 'Ticket added.');
  }

  @Patch('reorder')
  async reorder(
    @Param('eventId') eventId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    await this.tickets.reorder(event, dto.ids);

    return new ApiResult(
      this.serializer.full(await this.events.loadForResource(event.id)),
      'Tickets reordered.',
    );
  }

  @Put(':ticketId')
  async replace(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    return this.update(eventId, ticketId, dto, user);
  }

  @Patch(':ticketId')
  async update(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const ticket = await this.tickets.update(event, ticketId, dto);

    return new ApiResult(this.serializer.ticket(ticket), 'Ticket updated.');
  }

  @Delete(':ticketId')
  @HttpCode(200)
  async remove(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    await this.tickets.delete(event, ticketId);

    return new ApiResult(null, 'Ticket deleted.');
  }
}
