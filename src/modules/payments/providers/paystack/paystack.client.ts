import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../../config/env';
import { PaymentProviderException } from '../../exceptions/payment-provider.exception';

@Injectable()
export class PaystackClient {
  constructor(private readonly config: ConfigService<Env, true>) {}

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

  post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  }

  get(path: string): Promise<Record<string, unknown>> {
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
