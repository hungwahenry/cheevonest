import { ApiException } from '../../../common/exceptions/api.exception';

export class OtpThrottleException extends ApiException {
  constructor(retryAfterSeconds: number) {
    super(
      'Please wait before requesting another code.',
      429,
      { retry_after_seconds: retryAfterSeconds },
      'otp_throttled',
    );
  }
}
