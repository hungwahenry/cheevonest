import { ApiException } from '../../../common/exceptions/api.exception';

export class EmailAlreadyTakenException extends ApiException {
  constructor() {
    super('That email is already in use.', 422, {}, 'email_taken');
  }
}
