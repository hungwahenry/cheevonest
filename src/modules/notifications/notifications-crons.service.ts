import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailySalesDigestService } from './services/scheduled/daily-sales-digest.service';
import { StartingSoonService } from './services/scheduled/starting-soon.service';

@Injectable()
export class NotificationsCronsService {
  private readonly logger = new Logger(NotificationsCronsService.name);

  constructor(
    private readonly startingSoon: StartingSoonService,
    private readonly dailyDigest: DailySalesDigestService,
  ) {}

  @Cron('0 * * * *')
  async notifyStartingSoon(): Promise<void> {
    const count = await this.startingSoon.run();

    if (count > 0) {
      this.logger.log(`Sent starting-soon reminders for ${count} event(s).`);
    }
  }

  @Cron('0 9 * * *')
  async sendDailySalesDigest(): Promise<void> {
    const count = await this.dailyDigest.run();

    if (count > 0) {
      this.logger.log(`Sent ${count} daily sales digest(s).`);
    }
  }
}
