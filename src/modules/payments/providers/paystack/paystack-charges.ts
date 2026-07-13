import { Injectable } from '@nestjs/common';
import { Currency, PaymentStatus } from '../../../../generated/prisma/client';
import {
  InitializedPayment,
  InitializePaymentRequest,
  PaymentWebhookEvent,
  RefundRequest,
  RefundResult,
  VerifiedPayment,
} from '../../contracts/payment-provider.interface';
import { str } from '../../support/json';
import { PaystackClient } from './paystack.client';

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

  async refund(request: RefundRequest): Promise<RefundResult> {
    const data = await this.client.post('/refund', {
      transaction: request.reference,
      amount: request.amountMinor,
      currency: request.currency,
    });

    return {
      providerReference: data.id !== undefined ? str(data.id) : null,
      status: this.mapRefundStatus(str(data.status ?? '')),
      providerResponse: data,
    };
  }

  parseWebhookEvent(
    payload: Record<string, unknown>,
  ): PaymentWebhookEvent | null {
    const event = str(payload.event ?? '');
    const data = (payload.data ?? {}) as Record<string, unknown>;

    if (event === 'charge.success') {
      return {
        reference: str(data.reference ?? ''),
        providerReference: str(data.reference ?? ''),
        status: 'successful',
        amountMinor: Number(data.amount ?? 0),
        currency: (data.currency as Currency) ?? 'NGN',
        providerResponse: data,
      };
    }

    if (event === 'refund.processed') {
      return {
        reference: str(data.transaction_reference ?? ''),
        providerReference: null,
        status: 'refunded',
        amountMinor: Number(data.amount ?? 0),
        currency: (data.currency as Currency) ?? 'NGN',
        providerResponse: data,
      };
    }

    return null;
  }

  private mapRefundStatus(raw: string): RefundResult['status'] {
    switch (raw) {
      case 'processed':
        return 'processed';
      case 'processing':
        return 'processing';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
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
