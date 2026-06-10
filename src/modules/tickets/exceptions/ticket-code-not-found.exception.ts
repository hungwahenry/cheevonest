import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketCodeNotFoundException extends ApiException {
  constructor() {
    super('No ticket found for that code.', 404, {}, 'ticket_code_not_found');
  }
}
