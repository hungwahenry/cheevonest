import { ApiException } from '../../../../common/exceptions/api.exception';

export class OrderNotRefundableException extends ApiException {
  constructor(status: string) {
    super(
      `Only paid orders can be refunded; this one is ${status}.`,
      409,
      {},
      'order_not_refundable',
    );
  }
}
