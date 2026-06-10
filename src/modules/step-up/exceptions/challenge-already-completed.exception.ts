import { ApiException } from '../../../common/exceptions/api.exception';

export class ChallengeAlreadyCompletedException extends ApiException {
  constructor() {
    super(
      'This verification is already completed.',
      409,
      {},
      'step_up_completed',
    );
  }
}
