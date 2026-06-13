import { ApiException } from '../../../../common/exceptions/api.exception';

export class PaymentAlreadyFinalizedException extends ApiException {
  constructor(status: string) {
    super(
      `Payment is already ${status}.`,
      409,
      {},
      'payment_already_finalized',
    );
  }
}
