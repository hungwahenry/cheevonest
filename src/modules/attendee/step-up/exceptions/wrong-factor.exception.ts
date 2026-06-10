import { ApiException } from '../../../../common/exceptions/api.exception';

export class WrongFactorException extends ApiException {
  constructor() {
    super('Verify the previous step first.', 409, {}, 'step_up_wrong_factor');
  }
}
