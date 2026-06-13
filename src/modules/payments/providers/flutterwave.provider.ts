import { timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import { Currency, PaymentStatus } from '../../../generated/prisma/client';
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
} from '../contracts/payment-provider.interface';
import { PaymentProviderException } from '../exceptions/payment-provider.exception';
import { str } from '../support/json';

const MINOR_UNIT_MULTIPLIER = 100;

@Injectable()
export class FlutterwaveProvider implements PaymentProvider {
  constructor(private readonly config: ConfigService<Env, true>) {}

  name(): string {
    return 'flutterwave';
  }

  async initialize(
    request: InitializePaymentRequest,
  ): Promise<InitializedPayment> {
    const data = await this.request('/payments', {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: request.reference,
        amount: (request.amountMinor / MINOR_UNIT_MULTIPLIER).toFixed(2),
        currency: request.currency,
        redirect_url: request.callbackUrl,
        customer: { email: request.email },
        meta: request.metadata,
      }),
    });

    return {
      authorizationUrl: str(data.link ?? ''),
      providerReference: null,
      providerResponse: data,
    };
  }

  async verify(lookupKey: string): Promise<VerifiedPayment> {
    const data = await this.request(
      `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(lookupKey)}`,
      { method: 'GET' },
    );

    return {
      reference: str(data.tx_ref ?? ''),
      providerReference: data.id !== undefined ? str(data.id) : null,
      status: this.mapStatus(str(data.status ?? '')),
      amountMinor: Math.round(Number(data.amount ?? 0) * MINOR_UNIT_MULTIPLIER),
      currency: (data.currency as Currency) ?? 'NGN',
      providerResponse: data,
    };
  }

  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature?: string,
  ): boolean {
    if (!signature) {
      return false;
    }

    const secret = Buffer.from(this.secretHash());
    const provided = Buffer.from(signature);

    return (
      secret.length === provided.length && timingSafeEqual(secret, provided)
    );
  }

  parseWebhookEvent(
    payload: Record<string, unknown>,
  ): PaymentWebhookEvent | null {
    if (str(payload.event ?? '') !== 'charge.completed') {
      return null;
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;

    return {
      reference: str(data.tx_ref ?? ''),
      providerReference: data.id !== undefined ? str(data.id) : null,
      status: this.mapStatus(str(data.status ?? '')),
      amountMinor: Math.round(Number(data.amount ?? 0) * MINOR_UNIT_MULTIPLIER),
      currency: (data.currency as Currency) ?? 'NGN',
      providerResponse: data,
    };
  }

  parseTransferWebhookEvent(
    payload: Record<string, unknown>,
  ): TransferWebhookEvent | null {
    const event = str(payload.event ?? '');

    if (!['transfer.completed', 'transfer.disburse'].includes(event)) {
      return null;
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    const status =
      str(data.status ?? '').toUpperCase() === 'SUCCESSFUL' ? 'paid' : 'failed';

    return {
      reference: str(data.reference ?? ''),
      providerReference: data.id !== undefined ? str(data.id) : null,
      status,
      failureReason:
        status === 'failed' ? str(data.complete_message ?? '') : null,
      providerResponse: data,
    };
  }

  /** Flutterwave addresses transfers by bank details directly — no recipient objects. */
  createTransferRecipient(
    request: CreateTransferRecipientRequest,
  ): Promise<string | null> {
    void request;

    return Promise.resolve(null);
  }

  async transfer(request: InitiateTransferRequest): Promise<InitiatedTransfer> {
    const data = await this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        account_bank: request.bankCode,
        account_number: request.accountNumber,
        amount: request.amountMinor / MINOR_UNIT_MULTIPLIER,
        currency: request.currency,
        reference: request.reference,
        narration: request.reason,
      }),
    });

    return {
      providerReference:
        data.id !== undefined ? str(data.id) : request.reference,
      status: 'processing',
      providerResponse: data,
    };
  }

  private mapStatus(raw: string): PaymentStatus {
    switch (raw) {
      case 'successful':
        return 'successful';
      case 'failed':
        return 'failed';
      case 'cancelled':
        return 'abandoned';
      default:
        return 'pending';
    }
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<Record<string, unknown>> {
    const baseUrl = this.config.get('FLUTTERWAVE_BASE_URL', { infer: true });

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.get('FLUTTERWAVE_SECRET_KEY', { infer: true }) ?? ''}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      data?: Record<string, unknown>;
    };

    if (!response.ok || payload.status !== 'success') {
      throw new PaymentProviderException(
        'flutterwave',
        `${path}: ${payload.message ?? 'unknown error'}`,
      );
    }

    return payload.data ?? {};
  }

  private secretHash(): string {
    return this.config.get('FLUTTERWAVE_SECRET_HASH', { infer: true }) ?? '';
  }
}
