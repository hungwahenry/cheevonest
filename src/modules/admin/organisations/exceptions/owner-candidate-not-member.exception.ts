import { ApiException } from '../../../../common/exceptions/api.exception';

export class OwnerCandidateNotMemberException extends ApiException {
  constructor() {
    super(
      'The new owner must already be a member of the organisation.',
      422,
      {},
      'owner_candidate_not_member',
    );
  }
}
