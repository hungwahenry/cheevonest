import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Payout } from '../../../generated/prisma/client';
import { FeatureFlagsService } from '../../platform/system-config/feature-flags.service';
import { PayoutAccountLockedException } from '../exceptions/payout-account-locked.exception';
import { PayoutNotApprovableException } from '../exceptions/payout-not-approvable.exception';
import { PayoutNotPayableException } from '../exceptions/payout-not-payable.exception';
import { PayoutNotRejectableException } from '../exceptions/payout-not-rejectable.exception';
import { PayoutNotRetryableException } from '../exceptions/payout-not-retryable.exception';
import { PayoutsDisabledException } from '../exceptions/payouts-disabled.exception';
import { IN_FLIGHT_PAYOUT_STATUSES } from '../payout.constants';

@Injectable()
export class PayoutRules {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureFlagsService,
  ) {}

  async ensureEnabled(userId: string): Promise<void> {
    if (!(await this.features.enabled('payouts.enabled', { userId }))) {
      throw new PayoutsDisabledException();
    }
  }

  async ensureAccountEditable(organisationId: string): Promise<void> {
    const inFlight = await this.prisma.payout.count({
      where: {
        organisationId,
        status: { in: [...IN_FLIGHT_PAYOUT_STATUSES] },
      },
    });

    if (inFlight > 0) {
      throw new PayoutAccountLockedException();
    }
  }

  ensureApprovable(payout: Payout): void {
    if (payout.status !== 'requested') {
      throw new PayoutNotApprovableException(payout.status);
    }
  }

  ensureRejectable(payout: Payout): void {
    if (!['requested', 'approved'].includes(payout.status)) {
      throw new PayoutNotRejectableException(payout.status);
    }
  }

  ensurePayable(payout: Payout): void {
    if (!['approved', 'processing'].includes(payout.status)) {
      throw new PayoutNotPayableException(payout.status);
    }
  }

  ensureRetryable(payout: Payout): void {
    if (payout.status !== 'failed' || payout.transferMethod !== 'provider') {
      throw new PayoutNotRetryableException(payout.status);
    }
  }
}
