import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutNotPayableException extends ApiException {
  constructor(currentStatus: string) {
    super(
      `Only approved or processing payouts can be marked paid; this one is ${currentStatus}.`,
      409,
      {},
      'payout_not_payable',
    );
  }
}
