import { ApiException } from '../../../common/exceptions/api.exception';

export class BankAccountResolveFailedException extends ApiException {
  constructor(reason: string) {
    super(
      reason !== ''
        ? reason
        : "We couldn't verify that account number. Double-check the details.",
      422,
      {},
      'bank_account_resolve_failed',
    );
  }
}
