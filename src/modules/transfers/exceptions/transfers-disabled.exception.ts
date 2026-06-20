import { ApiException } from '../../../common/exceptions/api.exception';

export class TransfersDisabledException extends ApiException {
  constructor() {
    super(
      'Ticket transfers are currently disabled.',
      403,
      {},
      'transfers_disabled',
    );
  }
}
