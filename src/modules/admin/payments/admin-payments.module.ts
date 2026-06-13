import { Module } from '@nestjs/common';
import { PaymentsModule } from '../../payments/payments.module';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { AdminPaymentSerializer } from './serializers/admin-payment.serializer';
import { AdminPaymentsService } from './services/admin-payments.service';
import { PaymentModerationService } from './services/payment-moderation.service';

@Module({
  imports: [PaymentsModule],
  controllers: [AdminPaymentsController],
  providers: [
    AdminPaymentsService,
    PaymentModerationService,
    AdminPaymentSerializer,
  ],
})
export class AdminPaymentsModule {}
