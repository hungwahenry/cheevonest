import { Module } from '@nestjs/common';
import { AdminPayoutsModule } from './payouts/admin-payouts.module';

@Module({
  imports: [AdminPayoutsModule],
})
export class AdminModule {}
