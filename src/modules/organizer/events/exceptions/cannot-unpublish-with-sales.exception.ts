import { ApiException } from '../../../../common/exceptions/api.exception';

export class CannotUnpublishWithSalesException extends ApiException {
  constructor() {
    super(
      'This event already has ticket sales and can no longer be unpublished.',
      422,
      {},
      'cannot_unpublish_with_sales',
    );
  }
}
