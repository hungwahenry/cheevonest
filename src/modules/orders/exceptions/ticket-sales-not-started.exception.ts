import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketSalesNotStartedException extends ApiException {
  constructor(ticketName: string) {
    super(
      `Sales for "${ticketName}" haven't started.`,
      422,
      {},
      'ticket_sales_not_started',
    );
  }
}
