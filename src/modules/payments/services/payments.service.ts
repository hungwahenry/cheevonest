import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ulid } from 'ulid';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { Currency, Payment, User } from '../../../generated/prisma/client';
import { lockPaymentByReference } from '../../../generated/prisma/sql';
import {
  PaymentProvider,
  PaymentWebhookEvent,
} from '../contracts/payment-provider.interface';
import {
  PAYMENT_SUCCEEDED,
  PaymentSucceededEvent,
} from '../events/payment-succeeded.event';
import { PaymentProviderRegistry } from './payment-provider-registry.service';

const TERMINAL_STATUSES = ['successful', 'failed', 'abandoned', 'refunded'];

export interface StartPaymentInput {
  user: User;
  amountMinor: number;
  currency: Currency;
  callbackUrl: string;
  purposableType?: string;
  purposableId?: string;
  metadata?: Record<string, unknown>;
  providerName?: string | null;
}

export interface StartedPayment {
  payment: Payment;
  authorizationUrl: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PaymentProviderRegistry,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async start(input: StartPaymentInput): Promise<StartedPayment> {
    const provider = input.providerName
      ? this.registry.get(input.providerName)
      : this.registry.default();

    const reference = `${provider.name()}_${ulid()}`;

    const payment = await this.prisma.payment.create({
      data: {
        id: ulid(),
        userId: input.user.id,
        provider: provider.name(),
        reference,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: 'pending',
        purposableType: input.purposableType ?? null,
        purposableId: input.purposableId ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    const result = await provider.initialize({
      reference,
      amountMinor: input.amountMinor,
      currency: input.currency,
      email: input.user.email,
      callbackUrl: provider.requiresHttpsCallback()
        ? this.bridgeCallback(input.callbackUrl)
        : input.callbackUrl,
      metadata: input.metadata ?? {},
    });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerReference: result.providerReference,
        providerResponse: result.providerResponse as Prisma.InputJsonValue,
      },
    });

    return { payment: updated, authorizationUrl: result.authorizationUrl };
  }

  /** Applies a provider event to the payment exactly once; emits payment.succeeded after commit. */
  async finalize(event: PaymentWebhookEvent): Promise<Payment | null> {
    const settled = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawTyped(
        lockPaymentByReference(event.reference),
      );

      if (locked.length === 0) {
        return null;
      }

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: locked[0].id },
      });

      if (TERMINAL_STATUSES.includes(payment.status)) {
        return { payment, transitioned: false };
      }

      if (
        event.status === 'successful' &&
        (BigInt(event.amountMinor) !== payment.amountMinor ||
          event.currency !== payment.currency)
      ) {
        this.logger.warn(
          `finalize amount/currency mismatch for ${payment.reference}: expected ${payment.amountMinor} ${payment.currency}, got ${event.amountMinor} ${event.currency}`,
        );

        const failed = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            failedAt: new Date(),
            providerReference:
              event.providerReference ?? payment.providerReference,
            providerResponse: event.providerResponse as Prisma.InputJsonValue,
          },
        });

        return { payment: failed, transitioned: false };
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: event.status,
          providerReference:
            event.providerReference ?? payment.providerReference,
          providerResponse: event.providerResponse as Prisma.InputJsonValue,
          ...(event.status === 'successful'
            ? { authorizedAt: new Date() }
            : {}),
          ...(event.status === 'failed' || event.status === 'abandoned'
            ? { failedAt: new Date() }
            : {}),
          ...(event.status === 'refunded' ? { refundedAt: new Date() } : {}),
        },
      });

      return { payment: updated, transitioned: event.status === 'successful' };
    });

    if (!settled) {
      return null;
    }

    if (settled.transitioned) {
      await this.emitter.emitAsync(
        PAYMENT_SUCCEEDED,
        new PaymentSucceededEvent(
          settled.payment.id,
          settled.payment.purposableType,
          settled.payment.purposableId,
        ),
      );
    }

    return settled.payment;
  }

  /** Pull-verify against the provider; refuses transactions that belong to another payment. */
  async reconcile(
    payment: Payment,
    lookupKey?: string | null,
  ): Promise<Payment | null> {
    const provider = this.providerFor(payment);
    const verified = await provider.verify(lookupKey ?? payment.reference);

    if (verified.reference !== payment.reference) {
      this.logger.warn(
        `reconcile reference mismatch for payment ${payment.id}: expected ${payment.reference}, got ${verified.reference}`,
      );

      return payment;
    }

    return this.finalize({
      reference: payment.reference,
      providerReference: verified.providerReference,
      status: verified.status,
      amountMinor: verified.amountMinor,
      currency: verified.currency,
      providerResponse: verified.providerResponse,
    });
  }

  providerFor(payment: Payment): PaymentProvider {
    return this.registry.get(payment.provider);
  }

  private bridgeCallback(originalUrl: string): string {
    const bridge = this.bridgeUrl();

    if (bridge === '' || originalUrl.startsWith(bridge)) {
      return originalUrl;
    }

    return `${bridge}?return=${encodeURIComponent(originalUrl)}`;
  }

  private bridgeUrl(): string {
    const configured = this.config.get('PAYMENT_BRIDGE_URL', { infer: true });

    if (configured) {
      return configured.replace(/\/$/, '');
    }

    const appUrl = this.config
      .get('APP_URL', { infer: true })
      .replace(/\/$/, '');

    return `${appUrl}/payments/return`;
  }
}
