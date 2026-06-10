import { ApiException } from '../../../common/exceptions/api.exception';

export class UnknownTicketException extends ApiException {
  constructor() {
    super('Unknown ticket selected.', 404, {}, 'ticket_not_found');
  }
}
