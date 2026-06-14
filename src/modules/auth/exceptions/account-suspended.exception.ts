import { ApiException } from '../../../common/exceptions/api.exception';

export class AccountSuspendedException extends ApiException {
  constructor() {
    super('Your account has been suspended.', 403, {}, 'account_suspended');
  }
}
