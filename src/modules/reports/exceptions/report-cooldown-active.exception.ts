import { ApiException } from '../../../common/exceptions/api.exception';

export class ReportCooldownActiveException extends ApiException {
  constructor(retryAfterSeconds: number) {
    super(
      `You just submitted a report. Try again in ${retryAfterSeconds} seconds.`,
      429,
      { retry_after_seconds: retryAfterSeconds },
      'report_cooldown_active',
    );
  }
}
