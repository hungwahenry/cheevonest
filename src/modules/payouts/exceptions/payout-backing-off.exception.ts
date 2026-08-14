import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutBackingOffException extends ApiException {
  constructor(retryAfter: Date) {
    super(
      "This payout couldn't be completed. Please wait a little before trying again.",
      429,
      { retry_after: retryAfter.toISOString() },
      'payout_backing_off',
    );
  }
}
