import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketValidityEndedException extends ApiException {
  constructor(ticketName: string) {
    super(
      `"${ticketName}" is no longer valid for entry.`,
      422,
      {},
      'ticket_validity_ended',
    );
  }
}
