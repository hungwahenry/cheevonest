import { Module } from '@nestjs/common';
import { PayoutsModule } from '../../payouts/payouts.module';
import { AdminPayoutSerializer } from './admin-payout.serializer';
import { AdminPayoutsController } from './admin-payouts.controller';
import { AdminPayoutsService } from './admin-payouts.service';

@Module({
  imports: [PayoutsModule],
  controllers: [AdminPayoutsController],
  providers: [AdminPayoutsService, AdminPayoutSerializer],
})
export class AdminPayoutsModule {}
