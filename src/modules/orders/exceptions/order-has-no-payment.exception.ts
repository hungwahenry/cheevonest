import { ApiException } from '../../../common/exceptions/api.exception';

export class OrderHasNoPaymentException extends ApiException {
  constructor() {
    super(
      'This order has no payment to verify.',
      422,
      {},
      'order_has_no_payment',
    );
  }
}
