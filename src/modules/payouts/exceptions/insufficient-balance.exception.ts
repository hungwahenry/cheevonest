import { ApiException } from '../../../common/exceptions/api.exception';

export class InsufficientBalanceException extends ApiException {
  constructor(availableMinor: number) {
    super(
      'Requested amount is higher than your available balance.',
      422,
      { available_minor: availableMinor },
      'insufficient_balance',
    );
  }
}
