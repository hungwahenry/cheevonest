import { ApiException } from '../../../common/exceptions/api.exception';

export class BroadcastsDisabledException extends ApiException {
  constructor() {
    super(
      'Broadcasts are temporarily disabled.',
      503,
      {},
      'broadcasts_disabled',
    );
  }
}
