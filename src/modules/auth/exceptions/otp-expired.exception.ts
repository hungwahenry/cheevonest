import { ApiException } from '../../../common/exceptions/api.exception';

export class OtpExpiredException extends ApiException {
  constructor() {
    super('Your code has expired. Request a new one.', 422, {}, 'otp_expired');
  }
}
