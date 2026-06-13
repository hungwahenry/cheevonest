import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import {
  ListIssuedTicketsDto,
  TransferTicketDto,
} from '../dto/admin-issued-tickets.dto';
import { AdminIssuedTicketSerializer } from '../serializers/admin-issued-ticket.serializer';
import { AdminIssuedTicketsService } from '../services/admin-issued-tickets.service';
import { IssuedTicketModerationService } from '../services/issued-ticket-moderation.service';

@Roles('admin')
@Controller('admin/issued-tickets')
export class AdminIssuedTicketsController {
  constructor(
    private readonly tickets: AdminIssuedTicketsService,
    private readonly moderation: IssuedTicketModerationService,
    private readonly serializer: AdminIssuedTicketSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListIssuedTicketsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.tickets.page({
      page,
      perPage,
      status: dto.status,
      eventId: dto.event_id,
      search: dto.q,
    });

    return new Paginated(
      result.items.map((ticket) => this.serializer.ticket(ticket)),
      page,
      perPage,
      result.total,
    );
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @AuditAction('issued_tickets.revoke')
  async revoke(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const ticket = await this.moderation.findOrFail(id);
    await this.moderation.revoke(ticket);

    audit({ targetType: 'issued_ticket', targetId: ticket.id });

    return new ApiResult(
      this.serializer.ticket(await this.tickets.load(id)),
      'Ticket revoked.',
    );
  }

  @Post(':id/reissue')
  @HttpCode(200)
  @AuditAction('issued_tickets.reissue')
  async reissue(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const ticket = await this.moderation.findOrFail(id);
    const reissued = await this.moderation.reissue(ticket);

    audit({
      targetType: 'issued_ticket',
      targetId: ticket.id,
      payload: { new_code: reissued.code },
    });

    return new ApiResult(
      this.serializer.ticket(await this.tickets.load(id)),
      'Ticket reissued.',
    );
  }

  @Post(':id/transfer')
  @HttpCode(200)
  @AuditAction('issued_tickets.transfer')
  async transfer(
    @Param('id') id: string,
    @Body() dto: TransferTicketDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const ticket = await this.moderation.findOrFail(id);
    await this.moderation.transfer(ticket, dto.to_user_id);

    audit({
      targetType: 'issued_ticket',
      targetId: ticket.id,
      payload: {
        from_user_id: ticket.holderUserId,
        to_user_id: dto.to_user_id,
      },
      reason: dto.reason ?? null,
    });

    return new ApiResult(
      this.serializer.ticket(await this.tickets.load(id)),
      'Ticket transferred.',
    );
  }
}
