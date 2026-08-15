import { ApiException } from '../../../../common/exceptions/api.exception';

export class DebitExceedsBalanceException extends ApiException {
  constructor(availableMinor: number) {
    super(
      'Debit exceeds the available balance.',
      422,
      { available_minor: availableMinor },
      'debit_exceeds_balance',
    );
  }
}
