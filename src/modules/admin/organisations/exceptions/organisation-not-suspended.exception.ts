import { ApiException } from '../../../../common/exceptions/api.exception';

export class OrganisationNotSuspendedException extends ApiException {
  constructor() {
    super(
      'This organisation is not suspended.',
      409,
      {},
      'organisation_not_suspended',
    );
  }
}
