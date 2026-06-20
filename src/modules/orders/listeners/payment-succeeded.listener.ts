import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PAYMENT_SUCCEEDED,
  PaymentSucceededEvent,
} from '../../payments/events/payment-succeeded.event';
import { ORDER_PURPOSABLE } from '../orders.constants';
import { OrdersService } from '../services/orders.service';

@Injectable()
export class PaymentSucceededListener {
  constructor(private readonly orders: OrdersService) {}

  @OnEvent(PAYMENT_SUCCEEDED, { promisify: true })
  async handle(event: PaymentSucceededEvent): Promise<void> {
    if (event.purposableType === ORDER_PURPOSABLE && event.purposableId) {
      await this.orders.fulfill(event.purposableId);
    }
  }
}
