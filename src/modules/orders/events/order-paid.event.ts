export const ORDER_PAID = 'order.paid';

export class OrderPaidEvent {
  constructor(
    readonly orderId: string,
    readonly isFirstSale: boolean,
  ) {}
}
