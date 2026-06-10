import { ApiException } from '../../../common/exceptions/api.exception';

export class SameEmailException extends ApiException {
  constructor() {
    super('That is already your current email.', 422, {}, 'email_same');
  }
}
