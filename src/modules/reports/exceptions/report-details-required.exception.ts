import { ApiException } from '../../../common/exceptions/api.exception';

export class ReportDetailsRequiredException extends ApiException {
  constructor() {
    super(
      'Please add a few words explaining why you picked this reason.',
      422,
      {},
      'report_details_required',
    );
  }
}
