import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutNotReviewableException extends ApiException {
  constructor(currentStatus: string) {
    super(
      `Only payouts awaiting review can be approved or rejected; this one is ${currentStatus}.`,
      409,
      {},
      'payout_not_reviewable',
    );
  }
}
