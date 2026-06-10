import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutNotRetryableException extends ApiException {
  constructor(currentStatus: string) {
    super(
      `Only failed provider-method payouts can be retried; this one is ${currentStatus}.`,
      409,
      {},
      'payout_not_retryable',
    );
  }
}
