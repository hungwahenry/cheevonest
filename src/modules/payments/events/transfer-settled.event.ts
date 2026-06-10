import { TransferWebhookEvent } from '../contracts/payment-provider.interface';

export const TRANSFER_SETTLED = 'payment.transfer_settled';

export class TransferSettledEvent {
  constructor(readonly transfer: TransferWebhookEvent) {}
}
