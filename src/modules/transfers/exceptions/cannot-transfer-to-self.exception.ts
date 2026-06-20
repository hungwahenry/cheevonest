import { ApiException } from '../../../common/exceptions/api.exception';

export class CannotTransferToSelfException extends ApiException {
  constructor() {
    super(
      'You cannot transfer a ticket to yourself.',
      422,
      {},
      'cannot_transfer_to_self',
    );
  }
}
