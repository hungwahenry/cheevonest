import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentsModule } from '../payments/payments.module';
import { TicketsModule } from '../tickets/tickets.module';
import { PaymentSucceededListener } from './listeners/payment-succeeded.listener';
import { OrderWindowRules } from './rules/order-window.rules';
import { TicketAvailabilityRules } from './rules/ticket-availability.rules';
import { OrderSerializer } from './serializers/order.serializer';
import { OrderPricingService } from './services/order-pricing.service';
import { OrderPurposableResolver } from './services/order-purposable.resolver';
import { OrderQuotingService } from './services/order-quoting.service';
import { OrdersCronsService } from './services/orders-crons.service';
import { OrdersService } from './services/orders.service';

@Module({
  imports: [LedgerModule, PaymentsModule, TicketsModule],
  providers: [
    OrdersService,
    OrderQuotingService,
    OrderPricingService,
    OrdersCronsService,
    OrderWindowRules,
    TicketAvailabilityRules,
    OrderSerializer,
    OrderPurposableResolver,
    PaymentSucceededListener,
  ],
  exports: [OrdersService, OrderQuotingService, OrderSerializer],
})
export class OrdersModule {}
