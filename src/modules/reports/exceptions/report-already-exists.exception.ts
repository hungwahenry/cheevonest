import { ApiException } from '../../../common/exceptions/api.exception';

export class ReportAlreadyExistsException extends ApiException {
  constructor() {
    super(
      "You've already reported this. Our team will take a look.",
      409,
      {},
      'report_already_exists',
    );
  }
}
