import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutAccountCoolingOffException extends ApiException {
  constructor() {
    super(
      'Your payout account was changed recently. For your security, payouts are paused briefly — try again after the cooling-off period.',
      422,
      {},
      'payout_account_cooling_off',
    );
  }
}
