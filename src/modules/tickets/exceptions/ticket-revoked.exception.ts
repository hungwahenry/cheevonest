import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketRevokedException extends ApiException {
  constructor() {
    super('Ticket has been revoked.', 410, {}, 'ticket_revoked');
  }
}
