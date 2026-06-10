import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutAccountMissingException extends ApiException {
  constructor() {
    super(
      'Add a payout account before requesting a payout.',
      422,
      {},
      'payout_account_missing',
    );
  }
}
