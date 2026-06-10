import { ApiException } from '../../../../common/exceptions/api.exception';

export class ChallengeExpiredException extends ApiException {
  constructor() {
    super(
      'This verification has expired. Please start again.',
      410,
      {},
      'step_up_expired',
    );
  }
}
