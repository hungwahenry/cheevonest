import { Injectable, OnModuleInit } from '@nestjs/common';
import { PaymentPurposable } from '../../payments/contracts/purposable.interface';
import { PurposableRegistry } from '../../payments/services/purposable-registry.service';
import { ORDER_PURPOSABLE } from '../orders.constants';

@Injectable()
export class OrderPurposableResolver implements PaymentPurposable, OnModuleInit {
  readonly purposableType = ORDER_PURPOSABLE;

  constructor(private readonly registry: PurposableRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  returnParams(purposableId: string): Record<string, string> {
    return { order_id: purposableId };
  }
}
