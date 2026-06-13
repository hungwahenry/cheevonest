import { ApiException } from '../../../../common/exceptions/api.exception';

export class OrderNotMarkPayableException extends ApiException {
  constructor(status: string) {
    super(
      `Only pending orders can be marked paid; this one is ${status}.`,
      409,
      {},
      'order_not_mark_payable',
    );
  }
}
