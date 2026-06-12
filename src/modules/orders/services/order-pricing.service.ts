import { Injectable } from '@nestjs/common';
import { SystemConfigService } from '../../platform/system-config/system-config.service';

@Injectable()
export class OrderPricingService {
  constructor(private readonly systemConfig: SystemConfigService) {}

  /** Hybrid platform fee: percentage of subtotal (basis points) plus a flat amount, in minor units. Free orders incur no fee. */
  async fees(subtotalMinor: number): Promise<number> {
    if (subtotalMinor === 0) {
      return 0;
    }

    const bps = await this.systemConfig.int('orders.fee_percentage_bps', 300);
    const flat = await this.systemConfig.int('orders.fee_flat_minor', 10000);

    return Math.round((subtotalMinor * bps) / 10000) + flat;
  }
}
