import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketMaxPerOrderExceededException extends ApiException {
  constructor(ticketName: string, max: number) {
    super(
      `Max ${max} of "${ticketName}" per order.`,
      422,
      {},
      'ticket_max_per_order_exceeded',
    );
  }
}
