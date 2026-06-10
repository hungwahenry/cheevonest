import { ApiException } from '../../../../common/exceptions/api.exception';

export class AccountOwnsOrganisationsException extends ApiException {
  constructor() {
    super(
      'Transfer or delete your organisations before deleting your account.',
      409,
      {},
      'account_owns_organisations',
    );
  }
}
