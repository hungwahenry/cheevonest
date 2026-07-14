import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketExpiredException extends ApiException {
  constructor(validTo: string | null = null) {
    super(
      validTo
        ? `Ticket expired at ${validTo} and is no longer valid for entry.`
        : 'Ticket is no longer valid for entry.',
      422,
      {},
      'ticket_expired',
    );
  }
}
