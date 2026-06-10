import { ApiException } from '../../../../common/exceptions/api.exception';

export class CannotBlockYourselfException extends ApiException {
  constructor() {
    super("You can't block yourself.", 422, {}, 'cannot_block_yourself');
  }
}
