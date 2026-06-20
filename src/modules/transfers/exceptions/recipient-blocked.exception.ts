import { ApiException } from '../../../common/exceptions/api.exception';

export class RecipientBlockedException extends ApiException {
  constructor() {
    super(
      'You cannot transfer a ticket to this user.',
      422,
      {},
      'transfer_recipient_blocked',
    );
  }
}
