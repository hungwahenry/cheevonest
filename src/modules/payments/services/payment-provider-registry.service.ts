import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import { PaymentProvider } from '../contracts/payment-provider.interface';
import { PaystackProvider } from '../providers/paystack/paystack.provider';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(
    paystack: PaystackProvider,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.providers = new Map(
      [paystack].map((provider) => [provider.name(), provider]),
    );
  }

  get(name: string): PaymentProvider {
    const provider = this.providers.get(name);

    if (!provider) {
      throw new Error(`Unknown payment provider: ${name}`);
    }

    return provider;
  }

  default(): PaymentProvider {
    return this.get(
      this.config.get('PAYMENTS_DEFAULT_PROVIDER', { infer: true }),
    );
  }

  names(): string[] {
    return [...this.providers.keys()];
  }
}
