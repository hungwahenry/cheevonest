import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentsModule } from '../payments/payments.module';
import { TransferSettledListener } from './listeners/transfer-settled.listener';
import { PayoutRules } from './rules/payout.rules';
import { PayoutSerializer } from './serializers/payout.serializer';
import { BalanceService } from './services/balance.service';
import { BankResolverService } from './services/bank-resolver.service';
import { PayoutAccountsService } from './services/payout-accounts.service';
import { PayoutFeesService } from './services/payout-fees.service';
import { PayoutProcessingService } from './services/payout-processing.service';
import { PayoutsCronsService } from './services/payouts-crons.service';
import { PayoutsService } from './services/payouts.service';

@Module({
  imports: [LedgerModule, PaymentsModule],
  providers: [
    PayoutsService,
    PayoutProcessingService,
    PayoutAccountsService,
    BalanceService,
    BankResolverService,
    PayoutFeesService,
    PayoutsCronsService,
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
