import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketPerUserLimitExceededException extends ApiException {
  constructor(ticketName: string, max: number) {
    super(
      `You can only buy ${max} of "${ticketName}".`,
      422,
      {},
      'ticket_per_user_limit_exceeded',
    );
  }
}
