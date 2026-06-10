import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutsDisabledException extends ApiException {
  constructor() {
    super('Payouts are temporarily disabled.', 503, {}, 'payouts_disabled');
  }
}
