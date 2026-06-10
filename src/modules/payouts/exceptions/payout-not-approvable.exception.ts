import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutNotApprovableException extends ApiException {
  constructor(currentStatus: string) {
    super(
      `Only requested payouts can be approved; this one is ${currentStatus}.`,
      409,
      {},
      'payout_not_approvable',
    );
  }
}
