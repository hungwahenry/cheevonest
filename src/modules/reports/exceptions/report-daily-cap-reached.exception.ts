import { ApiException } from '../../../common/exceptions/api.exception';

export class ReportDailyCapReachedException extends ApiException {
  constructor(cap: number) {
    super(
      `You've submitted ${cap} reports today. Try again tomorrow.`,
      429,
      {},
      'report_daily_cap_reached',
    );
  }
}
