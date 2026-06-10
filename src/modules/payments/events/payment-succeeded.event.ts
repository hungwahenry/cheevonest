export const PAYMENT_SUCCEEDED = 'payment.succeeded';

export class PaymentSucceededEvent {
  constructor(
    readonly paymentId: string,
    readonly purposableType: string | null,
    readonly purposableId: string | null,
  ) {}
}
