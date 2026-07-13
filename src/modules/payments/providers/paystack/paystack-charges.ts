import { Injectable } from '@nestjs/common';
import { Currency, PaymentStatus } from '../../../../generated/prisma/client';
import {
  InitializedPayment,
  InitializePaymentRequest,
  PaymentWebhookEvent,
  VerifiedPayment,
} from '../../contracts/payment-provider.interface';
import { str } from '../../support/json';
import { PaystackClient } from './paystack.client';

const CHARGE_EVENT_STATUS: Record<string, PaymentStatus> = {
  'charge.success': 'successful',
  'charge.failed': 'failed',
  'charge.abandoned': 'abandoned',
  'refund.processed': 'refunded',
};

@Injectable()
export class PaystackCharges {
  constructor(private readonly client: PaystackClient) {}

  async initialize(
    request: InitializePaymentRequest,
  ): Promise<InitializedPayment> {
    const data = await this.client.post('/transaction/initialize', {
      email: request.email,
      amount: request.amountMinor,
      currency: request.currency,
      reference: request.reference,
      callback_url: request.callbackUrl,
      metadata: request.metadata,
    });

    return {
      authorizationUrl: str(data.authorization_url ?? ''),
      providerReference: str(data.reference ?? request.reference),
      providerResponse: data,
    };
  }

  async verify(lookupKey: string): Promise<VerifiedPayment> {
    const data = await this.client.get(
      `/transaction/verify/${encodeURIComponent(lookupKey)}`,
    );

    return {
      reference: str(data.reference, lookupKey),
      providerReference: data.reference ? str(data.reference) : null,
      status: this.mapStatus(str(data.status ?? '')),
      amountMinor: Number(data.amount ?? 0),
      currency: (data.currency as Currency) ?? 'NGN',
      providerResponse: data,
    };
  }

  parseWebhookEvent(
    payload: Record<string, unknown>,
  ): PaymentWebhookEvent | null {
    const status = CHARGE_EVENT_STATUS[str(payload.event ?? '')];

    if (!status) {
      return null;
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    const transaction = (data.transaction ?? {}) as Record<string, unknown>;

    return {
      reference: str(transaction.reference ?? data.reference ?? ''),
      providerReference: str(data.reference ?? transaction.reference ?? ''),
      status,
      amountMinor: Number(transaction.amount ?? data.amount ?? 0),
      currency: ((transaction.currency ?? data.currency) as Currency) ?? 'NGN',
      providerResponse: data,
    };
  }

  private mapStatus(raw: string): PaymentStatus {
    switch (raw) {
      case 'success':
        return 'successful';
      case 'failed':
        return 'failed';
      case 'abandoned':
        return 'abandoned';
      case 'reversed':
        return 'refunded';
      default:
        return 'pending';
    }
  }
}
