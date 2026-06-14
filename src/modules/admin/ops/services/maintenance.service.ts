import { Injectable } from '@nestjs/common';
import { EventsCronsService } from '../../../events/events-crons.service';
import { OrdersService } from '../../../orders/services/orders.service';
import { DailySalesDigestService } from '../../../notifications/services/scheduled/daily-sales-digest.service';
import { StartingSoonService } from '../../../notifications/services/scheduled/starting-soon.service';
import { SearchIndexerService } from '../../../search/services/search-indexer.service';
import { CommandNotAllowedException } from '../exceptions/command-not-allowed.exception';

interface MaintenanceCommand {
  description: string;
  run: () => Promise<unknown>;
}

@Injectable()
export class MaintenanceService {
  private readonly commands: Record<string, MaintenanceCommand>;

  constructor(
    orders: OrdersService,
    eventsCrons: EventsCronsService,
    startingSoon: StartingSoonService,
    dailyDigest: DailySalesDigestService,
    search: SearchIndexerService,
  ) {
    this.commands = {
      'orders:expire-holds': {
        description: 'Release expired ticket holds back to inventory.',
        run: () => orders.expireHolds(),
      },
      'orders:cancel-stale-pending': {
        description: 'Cancel pending orders that never completed payment.',
        run: () => orders.cancelStalePending(),
      },
      'events:mark-past': {
        description: 'Flip ended published events to the past state.',
        run: () => eventsCrons.markPastEvents(),
      },
      'notifications:event-starting-soon': {
        description: 'Send day-before reminders for imminent events.',
        run: () => startingSoon.run(),
      },
      'notifications:daily-sales-digest': {
        description: 'Send organisers their daily sales digest.',
        run: () => dailyDigest.run(),
      },
      'search:reindex': {
        description: 'Rebuild the full search index from source records.',
        run: () => search.reindexAll(),
      },
    };
  }

  list(): Array<{ command: string; description: string }> {
    return Object.entries(this.commands).map(([command, { description }]) => ({
      command,
      description,
    }));
  }

  async run(command: string): Promise<unknown> {
    const entry = this.commands[command];

    if (!entry) {
      throw new CommandNotAllowedException(command);
    }

    return entry.run();
  }
}
