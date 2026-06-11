import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutAccountLockedException extends ApiException {
  constructor() {
    super(
      'You have a payout in progress. Wait for it to clear before changing your payout account.',
      409,
      {},
      'payout_account_locked',
    );
  }
}
