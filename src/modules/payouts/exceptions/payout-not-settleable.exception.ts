import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutNotSettleableException extends ApiException {
  constructor(currentStatus: string) {
    super(
      `Only failed payouts can be settled off-platform; this one is ${currentStatus}.`,
      409,
      {},
      'payout_not_settleable',
    );
  }
}
