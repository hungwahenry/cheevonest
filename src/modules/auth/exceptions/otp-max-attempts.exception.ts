import { ApiException } from '../../../common/exceptions/api.exception';

export class OtpMaxAttemptsException extends ApiException {
  constructor() {
    super(
      'Too many incorrect attempts. Request a new code.',
      429,
      {},
      'otp_max_attempts',
    );
  }
}
