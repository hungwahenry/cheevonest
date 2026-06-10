import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketSalesEndedException extends ApiException {
  constructor(ticketName: string) {
    super(
      `Sales for "${ticketName}" have ended.`,
      422,
      {},
      'ticket_sales_ended',
    );
  }
}
