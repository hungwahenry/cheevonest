import { ApiException } from '../../../../common/exceptions/api.exception';

export class UnknownStepUpActionException extends ApiException {
  constructor() {
    super('Unknown step-up action.', 422, {}, 'step_up_unknown_action');
  }
}
