import { ApiException } from '../../../../common/exceptions/api.exception';

export class PartialRefundUnsupportedException extends ApiException {
  constructor() {
    super(
      'Partial refunds are not supported. Refund the full order total.',
      422,
      {},
      'partial_refund_unsupported',
    );
  }
}
