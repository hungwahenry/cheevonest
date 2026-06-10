import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersMaintenanceService {
  private readonly logger = new Logger(OrdersMaintenanceService.name);

  constructor(private readonly orders: OrdersService) {}

  @Cron('*/5 * * * *')
  async expireHolds(): Promise<void> {
    const count = await this.orders.expireHolds();

    if (count > 0) {
      this.logger.log(`Expired ${count} ticket hold(s).`);
    }
  }

  @Cron('*/15 * * * *')
  async cancelStalePendingOrders(): Promise<void> {
    const count = await this.orders.cancelStalePending();

    if (count > 0) {
      this.logger.log(`Cancelled ${count} stale pending order(s).`);
    }
  }
}
