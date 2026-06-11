import { ApiException } from '../../../../common/exceptions/api.exception';

export class CannotDeleteWithSalesException extends ApiException {
  constructor() {
    super(
      'This event already has ticket sales and can no longer be deleted.',
      422,
      {},
      'cannot_delete_with_sales',
    );
  }
}
