import { ApiException } from '../../../../common/exceptions/api.exception';

export class TicketNotReissuableException extends ApiException {
  constructor(status: string) {
    super(
      `Only revoked tickets can be reissued; this one is ${status}.`,
      409,
      {},
      'ticket_not_reissuable',
    );
  }
}
