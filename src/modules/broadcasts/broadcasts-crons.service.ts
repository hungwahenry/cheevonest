import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BroadcastDispatcherService } from './services/broadcast-dispatcher.service';

@Injectable()
export class BroadcastsCronsService {
  private readonly logger = new Logger(BroadcastsCronsService.name);

  constructor(private readonly dispatcher: BroadcastDispatcherService) {}

  @Cron('*/5 * * * *')
  async retryStuckBroadcasts(): Promise<void> {
    const count = await this.dispatcher.retryStuck();

    if (count > 0) {
      this.logger.log(`Re-dispatched ${count} stuck broadcast(s).`);
    }
  }
}
