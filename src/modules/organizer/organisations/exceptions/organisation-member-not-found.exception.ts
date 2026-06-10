import { ApiException } from '../../../../common/exceptions/api.exception';

export class OrganisationMemberNotFoundException extends ApiException {
  constructor() {
    super(
      'No cheevo account exists for that email. Ask them to sign up first.',
      422,
      {},
      'organisation_member_not_found',
    );
  }
}
