import { Injectable } from '@nestjs/common';
import type { Event } from '../../../generated/prisma/client';
import { UsersService } from '../../users/services/users.service';
import {
  OrderQuote,
  OrderQuotingService,
} from '../services/order-quoting.service';
import {
  CheckoutResult,
  OrderForResource,
  OrderItemInput,
  OrdersService,
} from '../services/orders.service';

export interface GuestCheckoutInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  items: OrderItemInput[];
  callbackUrl: string;
  provider?: string | null;
}

@Injectable()
export class GuestOrdersService {
  constructor(
    private readonly users: UsersService,
    private readonly orders: OrdersService,
    private readonly quoting: OrderQuotingService,
  ) {}

  quote(event: Event, items: OrderItemInput[]): Promise<OrderQuote> {
    return this.quoting.quote(event, items, 'web');
  }

  async checkout(
    event: Event,
    input: GuestCheckoutInput,
  ): Promise<CheckoutResult> {
    const user = await this.users.findOrCreateByEmail(input.email, {
      firstName: input.firstName,
      lastName: input.lastName,
    });

    return this.orders.create(
      user,
      event,
      input.items,
      input.callbackUrl,
      input.provider,
      'web',
    );
  }

  async view(token: string): Promise<OrderForResource> {
    const order = await this.orders.findByAccessTokenOrFail(token);

    return this.orders.loadForResource(order.id);
  }

  async verify(token: string): Promise<OrderForResource> {
    const order = await this.orders.findByAccessTokenOrFail(token);

    return this.orders.verifyWithProvider(order);
  }
}
