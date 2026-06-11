import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { TransferSettledListener } from './listeners/transfer-settled.listener';
import { PayoutRules } from './rules/payout.rules';
import { PayoutSerializer } from './serializers/payout.serializer';
import { BalanceService } from './services/balance.service';
import { BankResolverService } from './services/bank-resolver.service';
import { PayoutAccountsService } from './services/payout-accounts.service';
import { PayoutFeesService } from './services/payout-fees.service';
import { PayoutsService } from './services/payouts.service';

@Module({
  imports: [PaymentsModule],
  providers: [
    PayoutsService,
    PayoutAccountsService,
    BalanceService,
    BankResolverService,
    PayoutFeesService,
    PayoutRules,
    PayoutSerializer,
    TransferSettledListener,
  ],
  exports: [
    PayoutsService,
    PayoutAccountsService,
    BalanceService,
    BankResolverService,
    PayoutSerializer,
  ],
})
export class PayoutsModule {}
