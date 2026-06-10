import { ApiException } from '../../../common/exceptions/api.exception';

export class BroadcastCooldownActiveException extends ApiException {
  constructor(availableAt: string) {
    super(
      `You just sent a broadcast for this event. You can send another after ${availableAt}.`,
      429,
      { available_at: availableAt },
      'broadcast_cooldown_active',
    );
  }
}
