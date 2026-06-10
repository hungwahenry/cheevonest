import { ApiException } from '../../../common/exceptions/api.exception';

export class BroadcastLimitReachedException extends ApiException {
  constructor(limit: number) {
    super(
      `This event already has ${limit} broadcast${limit === 1 ? '' : 's'}. That's the limit per event.`,
      422,
      {},
      'broadcast_limit_reached',
    );
  }
}
