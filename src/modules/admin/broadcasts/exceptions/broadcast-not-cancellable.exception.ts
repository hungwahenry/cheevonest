import { ApiException } from '../../../../common/exceptions/api.exception';

export class BroadcastNotCancellableException extends ApiException {
  constructor(status: string) {
    super(
      `Only queued or sending broadcasts can be cancelled; this one is ${status}.`,
      409,
      {},
      'broadcast_not_cancellable',
    );
  }
}
