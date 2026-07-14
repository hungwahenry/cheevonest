import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketNotYetValidException extends ApiException {
  constructor(validFrom: string | null = null) {
    super(
      validFrom
        ? `Ticket is not valid for entry until ${validFrom}.`
        : 'Ticket is not valid for entry yet.',
      422,
      {},
      'ticket_not_yet_valid',
    );
  }
}
