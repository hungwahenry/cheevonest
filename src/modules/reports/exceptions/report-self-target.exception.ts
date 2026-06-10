import { ApiException } from '../../../common/exceptions/api.exception';

export class ReportSelfTargetException extends ApiException {
  constructor() {
    super("You can't report your own content.", 422, {}, 'report_self_target');
  }
}
