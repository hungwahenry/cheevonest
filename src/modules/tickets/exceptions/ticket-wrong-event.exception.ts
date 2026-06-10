import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketWrongEventException extends ApiException {
  constructor() {
    super(
      'Ticket belongs to a different event.',
      409,
      {},
      'ticket_wrong_event',
    );
  }
}
