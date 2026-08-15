import { ApiException } from '../../../../common/exceptions/api.exception';

export class DebitExceedsBalanceException extends ApiException {
  constructor(debitableMinor: number) {
    super(
      "Debit exceeds the organiser's available and held balance.",
      422,
      { debitable_minor: debitableMinor },
      'debit_exceeds_balance',
    );
  }
}
