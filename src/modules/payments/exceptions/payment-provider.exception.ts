import { ApiException } from '../../../common/exceptions/api.exception';

export class PaymentProviderException extends ApiException {
  constructor(provider: string, reason: string) {
    super(
      `Payment provider error (${provider}): ${reason}`,
      502,
      {},
      'payment_provider_error',
    );
  }
}
