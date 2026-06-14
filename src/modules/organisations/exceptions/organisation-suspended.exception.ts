import { ApiException } from '../../../common/exceptions/api.exception';

export class OrganisationSuspendedException extends ApiException {
  constructor() {
    super(
      'This organisation has been suspended.',
      403,
      {},
      'organisation_suspended',
    );
  }
}
