import { ApiException } from '../../../common/exceptions/api.exception';

export class BroadcastDailyCapReachedException extends ApiException {
  constructor(cap: number) {
    super(
      `You've hit today's broadcast volume cap (${cap} emails). Try again tomorrow.`,
      429,
      {},
      'broadcast_daily_cap_reached',
    );
  }
}
