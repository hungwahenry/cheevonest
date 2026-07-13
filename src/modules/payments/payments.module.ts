import { Module } from '@nestjs/common';
import { PaymentReturnController } from './controllers/payment-return.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { PaystackProvider } from './providers/paystack.provider';
import { PaymentProviderRegistry } from './services/payment-provider-registry.service';
import { PaymentsService } from './services/payments.service';
import { PurposableRegistry } from './services/purposable-registry.service';
import { WebhookIdempotencyService } from './services/webhook-idempotency.service';

@Module({
  controllers: [WebhooksController, PaymentReturnController],
  providers: [
    PaystackProvider,
    PaymentProviderRegistry,
    PaymentsService,
    PurposableRegistry,
    WebhookIdempotencyService,
  ],
  exports: [PaymentsService, PaymentProviderRegistry, PurposableRegistry],
})
export class PaymentsModule {}
