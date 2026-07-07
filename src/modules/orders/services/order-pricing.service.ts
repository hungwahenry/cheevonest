import { Injectable } from '@nestjs/common';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { OrderChannel } from '../orders.constants';

const DEFAULT_FEE_BPS = 300;
const DEFAULT_FEE_FLAT_MINOR = 10000;

@Injectable()
export class OrderPricingService {
  constructor(private readonly systemConfig: SystemConfigService) {}

  /**
   * Hybrid platform fee: percentage of subtotal (basis points) plus a flat amount, in minor units.
   * Free orders incur no fee. Web orders read override keys that fall back to the base (app) rate,
   * so the app-vs-web incentive is a pure config toggle with no code change.
   */
  async fees(
    subtotalMinor: number,
    channel: OrderChannel = 'app',
  ): Promise<number> {
    if (subtotalMinor === 0) {
      return 0;
    }

    const baseBps = await this.systemConfig.int(
      'orders.fee_percentage_bps',
      DEFAULT_FEE_BPS,
    );
    const baseFlat = await this.systemConfig.int(
      'orders.fee_flat_minor',
      DEFAULT_FEE_FLAT_MINOR,
    );

    const bps =
      channel === 'web'
        ? await this.systemConfig.int('orders.web.fee_percentage_bps', baseBps)
        : baseBps;
    const flat =
      channel === 'web'
        ? await this.systemConfig.int('orders.web.fee_flat_minor', baseFlat)
        : baseFlat;

    return Math.round((subtotalMinor * bps) / 10000) + flat;
  }
}
