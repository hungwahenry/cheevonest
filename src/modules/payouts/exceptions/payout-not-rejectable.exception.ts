import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutNotRejectableException extends ApiException {
  constructor(currentStatus: string) {
    super(
      `Only requested or approved payouts can be rejected; this one is ${currentStatus}.`,
      409,
      {},
      'payout_not_rejectable',
    );
  }
}
