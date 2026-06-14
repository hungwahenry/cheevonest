import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdminBroadcastService } from './admin-broadcast.service';

@Injectable()
export class AdminBroadcastCronsService {
  private readonly logger = new Logger(AdminBroadcastCronsService.name);

  constructor(private readonly broadcasts: AdminBroadcastService) {}

  @Cron('* * * * *')
  async dispatchScheduled(): Promise<void> {
    const dispatched = await this.broadcasts.runDue();

    if (dispatched > 0) {
      this.logger.log(`Dispatched ${dispatched} scheduled broadcast(s).`);
    }
  }
}
