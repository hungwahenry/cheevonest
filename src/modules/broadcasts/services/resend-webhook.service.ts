import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { Env } from '../../../config/env';
import { str } from '../../payments/support/json';
import { SuppressionsService } from './suppressions.service';

const REASON_BY_TYPE: Record<string, 'bounced' | 'complained'> = {
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

@Injectable()
export class ResendWebhookService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly suppressions: SuppressionsService,
  ) {}

  verifySignature(
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ): boolean {
    const secret = this.config.get('RESEND_WEBHOOK_SECRET', { infer: true });

    if (!secret) {
      return false;
    }

    try {
      new Webhook(secret).verify(
        typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'),
        headers,
      );

      return true;
    } catch {
      return false;
    }
  }

  /** Bounces and complaints become GLOBAL suppressions — no org sends to them again. */
  async record(payload: Record<string, unknown>): Promise<void> {
    const reason = REASON_BY_TYPE[str(payload.type)];

    if (!reason) {
      return;
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    const to = Array.isArray(data.to) ? data.to : [];

    for (const email of to) {
      if (typeof email === 'string' && email.trim() !== '') {
        await this.suppressions.suppress(email.trim(), null, reason);
      }
    }
  }
}
