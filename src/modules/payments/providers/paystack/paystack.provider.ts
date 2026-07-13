import { Injectable } from '@nestjs/common';
import {
  CreateTransferRecipientRequest,
  InitializedPayment,
  InitializePaymentRequest,
  InitiatedTransfer,
  InitiateTransferRequest,
  PaymentProvider,
  PaymentWebhookEvent,
  TransferWebhookEvent,
  VerifiedPayment,
} from '../../contracts/payment-provider.interface';
import { PaystackCharges } from './paystack-charges';
import { PaystackClient } from './paystack.client';
import { PaystackTransfers } from './paystack-transfers';

@Injectable()
export class PaystackProvider implements PaymentProvider {
  constructor(
    private readonly client: PaystackClient,
    private readonly charges: PaystackCharges,
    private readonly transfers: PaystackTransfers,
  ) {}

  name(): string {
    return 'paystack';
  }

  initialize(request: InitializePaymentRequest): Promise<InitializedPayment> {
    return this.charges.initialize(request);
  }

  verify(lookupKey: string): Promise<VerifiedPayment> {
    return this.charges.verify(lookupKey);
  }

  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature?: string,
  ): boolean {
    return this.client.verifyWebhookSignature(rawBody, signature);
  }

  parseWebhookEvent(
    payload: Record<string, unknown>,
  ): PaymentWebhookEvent | null {
    return this.charges.parseWebhookEvent(payload);
  }

  parseTransferWebhookEvent(
    payload: Record<string, unknown>,
  ): TransferWebhookEvent | null {
    return this.transfers.parseWebhookEvent(payload);
  }

  createTransferRecipient(
    request: CreateTransferRecipientRequest,
  ): Promise<string | null> {
    return this.transfers.createTransferRecipient(request);
  }

  transfer(request: InitiateTransferRequest): Promise<InitiatedTransfer> {
    return this.transfers.transfer(request);
  }

  verifyTransfer(reference: string): Promise<TransferWebhookEvent | null> {
    return this.transfers.verify(reference);
  }
}
