import { ApiException } from '../../../../common/exceptions/api.exception';

export class OrganisationMemberAlreadyExistsException extends ApiException {
  constructor() {
    super(
      'That person is already on the team.',
      409,
      {},
      'organisation_member_already_exists',
    );
  }
}
