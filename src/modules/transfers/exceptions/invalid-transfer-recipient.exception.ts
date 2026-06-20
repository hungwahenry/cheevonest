import { ApiException } from '../../../common/exceptions/api.exception';

export class InvalidTransferRecipientException extends ApiException {
  constructor() {
    super(
      'That user cannot receive this ticket.',
      422,
      {},
      'invalid_transfer_recipient',
    );
  }
}
