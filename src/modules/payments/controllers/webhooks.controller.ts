import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../auth/decorators/auth.decorators';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';
import { PaymentProviderRegistry } from '../services/payment-provider-registry.service';
import { PaymentsService } from '../services/payments.service';
import { WebhookIdempotencyService } from '../services/webhook-idempotency.service';
import { str } from '../support/json';
import {
  TRANSFER_SETTLED,
  TransferSettledEvent,
} from '../events/transfer-settled.event';

@Public()
@SkipEnvelope()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly payments: PaymentsService,
    private readonly idempotency: WebhookIdempotencyService,
    private readonly emitter: EventEmitter2,
  ) {}

  @Post('paystack')
  @HttpCode(200)
  async paystack(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('x-paystack-signature') signature?: string,
  ): Promise<string> {
    const payload = await this.acceptedPayload(
      'paystack',
      request,
      signature,
      (data) => str(data.id ?? data.reference ?? ''),
    );

    if (payload === null) {
      return '';
    }

    await this.dispatch('paystack', payload);

    return '';
  }

  @Post('flutterwave')
  @HttpCode(200)
  async flutterwave(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('verif-hash') signature?: string,
  ): Promise<string> {
    const payload = await this.acceptedPayload(
      'flutterwave',
      request,
      signature,
      (data) => str(data.id ?? data.tx_ref ?? ''),
    );

    if (payload === null) {
      return '';
    }

    await this.dispatch('flutterwave', payload);

    return '';
  }

  private async dispatch(
    providerName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const provider = this.registry.get(providerName);
    const charge = provider.parseWebhookEvent(payload);

    if (charge) {
      await this.payments.finalize(charge);

      return;
    }

    const transfer = provider.parseTransferWebhookEvent(payload);

    if (transfer) {
      await this.emitter.emitAsync(
        TRANSFER_SETTLED,
        new TransferSettledEvent(transfer),
      );
    }
  }

  /** Verifies the signature and the replay guard; null means "acknowledged, nothing to do". */
  private async acceptedPayload(
    providerName: string,
    request: RawBodyRequest<FastifyRequest>,
    signature: string | undefined,
    externalId: (data: Record<string, unknown>) => string,
  ): Promise<Record<string, unknown> | null> {
    const provider = this.registry.get(providerName);
    const rawBody = request.rawBody ?? Buffer.from('');

    if (!provider.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn(`${providerName} webhook signature invalid`);
      throw new UnauthorizedException();
    }

    const payload = (request.body ?? {}) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    const fresh = await this.idempotency.recordIfNew(
      providerName,
      str(payload.event),
      externalId(data),
      payload,
    );

    return fresh ? payload : null;
  }
}
