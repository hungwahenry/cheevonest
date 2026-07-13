import { Module } from '@nestjs/common';
import { PaymentReturnController } from './controllers/payment-return.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { PaystackCharges } from './providers/paystack/paystack-charges';
import { PaystackClient } from './providers/paystack/paystack.client';
import { PaystackProvider } from './providers/paystack/paystack.provider';
import { PaystackTransfers } from './providers/paystack/paystack-transfers';
import { PaymentProviderRegistry } from './services/payment-provider-registry.service';
import { PaymentsService } from './services/payments.service';
import { PurposableRegistry } from './services/purposable-registry.service';
import { WebhookIdempotencyService } from './services/webhook-idempotency.service';

@Module({
  controllers: [WebhooksController, PaymentReturnController],
  providers: [
    PaystackClient,
    PaystackCharges,
    PaystackTransfers,
    PaystackProvider,
    PaymentProviderRegistry,
    PaymentsService,
    PurposableRegistry,
    WebhookIdempotencyService,
  ],
  exports: [PaymentsService, PaymentProviderRegistry, PurposableRegistry],
})
export class PaymentsModule {}
