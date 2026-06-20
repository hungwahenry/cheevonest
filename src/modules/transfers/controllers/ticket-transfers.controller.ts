import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { TicketSerializer } from '../../tickets/serializers/ticket.serializer';
import { TicketListingService } from '../../tickets/services/ticket-listing.service';
import { TransferTicketDto } from '../dto/transfer-ticket.dto';
import { TicketTransferService } from '../services/ticket-transfer.service';

@Controller('attendee/tickets')
export class TicketTransfersController {
  constructor(
    private readonly transfers: TicketTransferService,
    private readonly listing: TicketListingService,
    private readonly serializer: TicketSerializer,
  ) {}

  @Post(':ticketId/transfer')
  @HttpCode(200)
  async transfer(
    @Param('ticketId') ticketId: string,
    @Body() dto: TransferTicketDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const ticket = await this.transfers.transfer(ticketId, user, dto.to_user_id);

    return new ApiResult(
      this.serializer.myTicket(await this.listing.heldOne(ticket.id)),
      'Ticket transferred.',
    );
  }
}
