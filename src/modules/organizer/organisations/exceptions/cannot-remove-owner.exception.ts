import { ApiException } from '../../../../common/exceptions/api.exception';

export class CannotRemoveOwnerException extends ApiException {
  constructor() {
    super(
      "You can't remove the owner from their organisation.",
      422,
      {},
      'cannot_remove_owner',
    );
  }
}
