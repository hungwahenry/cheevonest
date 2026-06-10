import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledNotificationsService } from './services/scheduled-notifications.service';

@Injectable()
export class NotificationsCronsService {
  private readonly logger = new Logger(NotificationsCronsService.name);

  constructor(private readonly scheduled: ScheduledNotificationsService) {}

  @Cron('0 * * * *')
  async notifyStartingSoon(): Promise<void> {
    const count = await this.scheduled.notifyStartingSoon();

    if (count > 0) {
      this.logger.log(`Sent starting-soon reminders for ${count} event(s).`);
    }
  }

  @Cron('0 9 * * *')
  async sendDailySalesDigest(): Promise<void> {
    const count = await this.scheduled.sendDailySalesDigest();

    if (count > 0) {
      this.logger.log(`Sent ${count} daily sales digest(s).`);
    }
  }
}
