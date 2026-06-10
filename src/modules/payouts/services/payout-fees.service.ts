import { Injectable } from '@nestjs/common';
import { SystemConfigService } from '../../platform/system-config/system-config.service';

@Injectable()
export class PayoutFeesService {
  constructor(private readonly systemConfig: SystemConfigService) {}

  /** Paystack's tiered NGN transfer fee, passed on to the organiser. */
  async transferFee(amountMinor: number): Promise<number> {
    const naira = amountMinor / 100;

    const tier1Ceiling = await this.systemConfig.int(
      'payouts.transfer_fee_tier_1_naira',
      5_000,
    );
    const tier2Ceiling = await this.systemConfig.int(
      'payouts.transfer_fee_tier_2_naira',
      50_000,
    );

    if (naira <= tier1Ceiling) {
      return this.systemConfig.int('payouts.transfer_fee_tier_1_minor', 1_000);
    }

    if (naira <= tier2Ceiling) {
      return this.systemConfig.int('payouts.transfer_fee_tier_2_minor', 2_500);
    }

    return this.systemConfig.int('payouts.transfer_fee_tier_3_minor', 5_000);
  }
}
