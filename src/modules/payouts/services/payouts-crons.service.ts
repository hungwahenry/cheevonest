import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PayoutsService } from './payouts.service';

@Injectable()
export class PayoutsCronsService {
  private readonly logger = new Logger(PayoutsCronsService.name);

  constructor(private readonly payouts: PayoutsService) {}

  @Cron('*/10 * * * *')
  async reconcileStuckPayouts(): Promise<void> {
    const { initiated, reconciled } = await this.payouts.sweepStuck();

    if (initiated + reconciled > 0) {
      this.logger.log(
        `Swept stuck payouts: initiated ${initiated}, reconciled ${reconciled}.`,
      );
    }
  }
}
