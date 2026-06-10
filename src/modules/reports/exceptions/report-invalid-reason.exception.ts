import { ApiException } from '../../../common/exceptions/api.exception';

export class ReportInvalidReasonException extends ApiException {
  constructor() {
    super(
      "That reason isn't available for this kind of report.",
      422,
      {},
      'report_invalid_reason',
    );
  }
}
