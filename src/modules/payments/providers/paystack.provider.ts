import { createHmac, timingSafeEqual } from 'node:crypto';
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

const CHARGE_EVENT_STATUS: Record<string, PaymentStatus> = {
  'charge.success': 'successful',
  'charge.failed': 'failed',
  'charge.abandoned': 'abandoned',
  'refund.processed': 'refunded',
};

@Injectable()
export class PaystackProvider implements PaymentProvider {
  constructor(private readonly config: ConfigService<Env, true>) {}

  name(): string {
    return 'paystack';
  }

  async initialize(
    request: InitializePaymentRequest,
  ): Promise<InitializedPayment> {
    const data = await this.post('/transaction/initialize', {
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
    const data = await this.get(
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

  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature?: string,
  ): boolean {
    if (!signature) {
      return false;
    }

    const expected = createHmac('sha512', this.secretKey())
      .update(rawBody)
      .digest('hex');
    const provided = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    return (
      provided.length === expectedBuffer.length &&
      timingSafeEqual(provided, expectedBuffer)
    );
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

  parseTransferWebhookEvent(
    payload: Record<string, unknown>,
  ): TransferWebhookEvent | null {
    const event = str(payload.event ?? '');

    if (
      !['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(
        event,
      )
    ) {
      return null;
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    const status = event === 'transfer.success' ? 'paid' : 'failed';

    return {
      reference: str(data.reference ?? ''),
      providerReference: data.transfer_code ? str(data.transfer_code) : null,
      status,
      failureReason:
        status === 'failed'
          ? str(data.reason ?? data.failure_reason ?? '')
          : null,
      providerResponse: data,
    };
  }

  async createTransferRecipient(
    request: CreateTransferRecipientRequest,
  ): Promise<string | null> {
    const data = await this.post('/transferrecipient', {
      type: 'nuban',
      name: request.name,
      account_number: request.accountNumber,
      bank_code: request.bankCode,
      currency: request.currency,
    });

    const code = str(data.recipient_code);

    return code !== '' ? code : null;
  }

  async transfer(request: InitiateTransferRequest): Promise<InitiatedTransfer> {
    if (request.recipientCode === null) {
      throw new PaymentProviderException(
        'paystack',
        'transfer: recipient_code is required',
      );
    }

    const data = await this.post('/transfer', {
      source: 'balance',
      amount: request.amountMinor,
      currency: request.currency,
      recipient: request.recipientCode,
      reference: request.reference,
      reason: request.reason,
    });

    return {
      providerReference: str(
        data.transfer_code,
        str(data.reference, request.reference),
      ),
      status: 'processing',
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

  private async post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async get(path: string): Promise<Record<string, unknown>> {
    return this.request(path, { method: 'GET' });
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<Record<string, unknown>> {
    const baseUrl = this.config.get('PAYSTACK_BASE_URL', { infer: true });

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: Record<string, unknown>;
    };

    if (!response.ok || payload.status !== true) {
      throw new PaymentProviderException(
        'paystack',
        `${init.method === 'POST' ? path.slice(1) : 'verify'}: ${payload.message ?? 'unknown error'}`,
      );
    }

    return payload.data ?? {};
  }

  private secretKey(): string {
    return this.config.get('PAYSTACK_SECRET_KEY', { infer: true }) ?? '';
  }
}
