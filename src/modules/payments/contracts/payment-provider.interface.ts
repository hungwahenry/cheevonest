import type { Currency, PaymentStatus } from '../../../generated/prisma/client';

export interface InitializePaymentRequest {
  reference: string;
  amountMinor: number;
  currency: Currency;
  email: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface InitializedPayment {
  authorizationUrl: string;
  providerReference: string | null;
  providerResponse: Record<string, unknown>;
}

export interface VerifiedPayment {
  reference: string;
  providerReference: string | null;
  status: PaymentStatus;
  amountMinor: number;
  currency: Currency;
  providerResponse: Record<string, unknown>;
}

export interface PaymentWebhookEvent {
  reference: string;
  providerReference: string | null;
  status: PaymentStatus;
  amountMinor: number;
  currency: Currency;
  providerResponse: Record<string, unknown>;
}

export interface RefundRequest {
  reference: string;
  amountMinor: number;
  currency: Currency;
}

export interface RefundResult {
  providerReference: string | null;
  status: 'pending' | 'processed';
  providerResponse: Record<string, unknown>;
}

export interface CreateTransferRecipientRequest {
  name: string;
  accountNumber: string;
  bankCode: string;
  currency: Currency;
}

export interface InitiateTransferRequest {
  amountMinor: number;
  currency: Currency;
  reference: string;
  reason: string;
  recipientCode: string | null;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export interface InitiatedTransfer {
  providerReference: string;
  status: 'processing';
  providerResponse: Record<string, unknown>;
}

export interface TransferWebhookEvent {
  reference: string;
  providerReference: string | null;
  status: 'paid' | 'failed' | 'reversed';
  failureReason: string | null;
  providerResponse: Record<string, unknown>;
}

export interface PaymentProvider {
  name(): string;
  initialize(request: InitializePaymentRequest): Promise<InitializedPayment>;
  verify(lookupKey: string): Promise<VerifiedPayment>;
  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean;
  parseWebhookEvent(
    payload: Record<string, unknown>,
  ): PaymentWebhookEvent | null;
  refund(request: RefundRequest): Promise<RefundResult>;
  parseTransferWebhookEvent(
    payload: Record<string, unknown>,
  ): TransferWebhookEvent | null;
  createTransferRecipient(
    request: CreateTransferRecipientRequest,
  ): Promise<string | null>;
  transfer(request: InitiateTransferRequest): Promise<InitiatedTransfer>;
  verifyTransfer(reference: string): Promise<TransferWebhookEvent | null>;
}
