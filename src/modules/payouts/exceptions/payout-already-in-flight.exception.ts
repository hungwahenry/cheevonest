import { ApiException } from '../../../common/exceptions/api.exception';

export class PayoutAlreadyInFlightException extends ApiException {
  constructor() {
    super(
      'You already have a payout request in progress. Wait for it to clear before requesting another.',
      409,
      {},
      'payout_already_in_flight',
    );
  }
}
