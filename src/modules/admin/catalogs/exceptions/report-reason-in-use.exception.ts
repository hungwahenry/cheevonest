import { ApiException } from '../../../../common/exceptions/api.exception';

export class ReportReasonInUseException extends ApiException {
  constructor(count: number) {
    super(
      `This report reason is referenced by ${count} report(s). Deactivate it instead of deleting.`,
      409,
      {},
      'report_reason_in_use',
    );
  }
}
