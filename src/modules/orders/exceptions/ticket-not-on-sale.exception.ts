import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketNotOnSaleException extends ApiException {
  constructor(ticketName: string) {
    super(
      `Ticket "${ticketName}" isn't on sale.`,
      422,
      {},
      'ticket_not_on_sale',
    );
  }
}
