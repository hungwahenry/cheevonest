import { Injectable } from '@nestjs/common';
import { PaymentPurposable } from '../contracts/purposable.interface';

@Injectable()
export class PurposableRegistry {
  private readonly resolvers = new Map<string, PaymentPurposable>();

  register(resolver: PaymentPurposable): void {
    this.resolvers.set(resolver.purposableType, resolver);
  }

  async returnParams(
    type: string | null,
    id: string | null,
  ): Promise<Record<string, string>> {
    if (!type || !id) {
      return {};
    }

    const resolver = this.resolvers.get(type);

    return resolver ? resolver.returnParams(id) : {};
  }
}
