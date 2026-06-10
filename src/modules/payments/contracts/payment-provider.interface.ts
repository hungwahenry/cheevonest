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

export interface TransferWebhookEvent {
  reference: string;
  providerReference: string | null;
  status: 'paid' | 'failed';
  failureReason: string | null;
  providerResponse: Record<string, unknown>;
}

export interface PaymentProvider {
  name(): string;
  requiresHttpsCallback(): boolean;
  initialize(request: InitializePaymentRequest): Promise<InitializedPayment>;
  verify(lookupKey: string): Promise<VerifiedPayment>;
  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean;
  parseWebhookEvent(
    payload: Record<string, unknown>,
  ): PaymentWebhookEvent | null;
  parseTransferWebhookEvent(
    payload: Record<string, unknown>,
  ): TransferWebhookEvent | null;
}
