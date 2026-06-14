import { ApiException } from '../../../../common/exceptions/api.exception';

export class BroadcastNotSendableException extends ApiException {
  constructor(status: string) {
    super(
      `A ${status} broadcast cannot be sent.`,
      409,
      {},
      'broadcast_not_sendable',
    );
  }
}
