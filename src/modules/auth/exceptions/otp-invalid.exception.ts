import { ApiException } from '../../../common/exceptions/api.exception';

export class OtpInvalidException extends ApiException {
  constructor() {
    super('The code you entered is incorrect.', 422, {}, 'otp_invalid');
  }
}
