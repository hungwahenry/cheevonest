import { ApiException } from '../../../common/exceptions/api.exception';

export class ReportInvalidTargetException extends ApiException {
  constructor() {
    super(
      "The thing you're trying to report no longer exists.",
      422,
      {},
      'report_invalid_target',
    );
  }
}
