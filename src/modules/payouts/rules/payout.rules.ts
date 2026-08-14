import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Payout, PayoutAccount } from '../../../generated/prisma/client';
import { FeatureFlagsService } from '../../platform/system-config/feature-flags.service';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { PayoutAccountCoolingOffException } from '../exceptions/payout-account-cooling-off.exception';
import { PayoutAccountLockedException } from '../exceptions/payout-account-locked.exception';
import { PayoutBackingOffException } from '../exceptions/payout-backing-off.exception';
import { PayoutNotRetryableException } from '../exceptions/payout-not-retryable.exception';
import { PayoutNotReviewableException } from '../exceptions/payout-not-reviewable.exception';
import { PayoutNotSettleableException } from '../exceptions/payout-not-settleable.exception';
import { PayoutsDisabledException } from '../exceptions/payouts-disabled.exception';
import { IN_FLIGHT_PAYOUT_STATUSES } from '../payout.constants';

@Injectable()
export class PayoutRules {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureFlagsService,
    private readonly systemConfig: SystemConfigService,
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

  ensureRetryable(payout: Payout): void {
    if (payout.status !== 'failed') {
      throw new PayoutNotRetryableException(payout.status);
    }
  }

  ensureReviewable(payout: Payout): void {
    if (payout.status !== 'pending_review') {
      throw new PayoutNotReviewableException(payout.status);
    }
  }

  ensureManuallySettleable(payout: Payout): void {
    if (payout.status !== 'failed') {
      throw new PayoutNotSettleableException(payout.status);
    }
  }

  /** When payouts are paused after a genuine bank-account change, else null. */
  async pausedUntil(account: PayoutAccount): Promise<Date | null> {
    if (account.detailsChangedAt === null) {
      return null;
    }

    const cooldownHours = await this.systemConfig.int(
      'payouts.account_change_cooldown_hours',
      24,
    );

    if (cooldownHours <= 0) {
      return null;
    }

    const readyAt = new Date(
      account.detailsChangedAt.getTime() + cooldownHours * 3_600_000,
    );

    return readyAt > new Date() ? readyAt : null;
  }

  /** Blocks payouts briefly after a genuine bank-account change (anti-takeover). */
  async ensureAccountSettled(account: PayoutAccount): Promise<void> {
    if (await this.pausedUntil(account)) {
      throw new PayoutAccountCoolingOffException();
    }
  }

  /**
   * Escalating cooldown after consecutive failed payouts, so a stuck transfer
   * (e.g. provider float) can't be hammered. Doubles per failure up to the cap.
   */
  async backoffUntil(organisationId: string): Promise<Date | null> {
    const baseMinutes = await this.systemConfig.int(
      'payouts.failure_backoff_base_minutes',
      15,
    );

    if (baseMinutes <= 0) {
      return null;
    }

    const recent = await this.prisma.payout.findMany({
      where: { organisationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { status: true, failedAt: true, createdAt: true },
    });

    let consecutive = 0;
    for (const payout of recent) {
      if (payout.status !== 'failed') {
        break;
      }
      consecutive += 1;
    }

    if (consecutive === 0) {
      return null;
    }

    const maxMinutes = await this.systemConfig.int(
      'payouts.failure_backoff_max_minutes',
      120,
    );
    const waitMinutes = Math.min(
      baseMinutes * 2 ** (consecutive - 1),
      maxMinutes,
    );
    const last = recent[0].failedAt ?? recent[0].createdAt;
    const readyAt = new Date(last.getTime() + waitMinutes * 60_000);

    return readyAt > new Date() ? readyAt : null;
  }

  async ensureNotBackingOff(organisationId: string): Promise<void> {
    const readyAt = await this.backoffUntil(organisationId);

    if (readyAt) {
      throw new PayoutBackingOffException(readyAt);
    }
  }

  /** A payout needs review if it exceeds the auto-approve cap or is the org's first. */
  async requiresReview(
    organisationId: string,
    amountMinor: number,
  ): Promise<boolean> {
    const maxAuto = await this.systemConfig.int(
      'payouts.auto_approve_max_minor',
      50_000_000,
    );

    if (amountMinor > maxAuto) {
      return true;
    }

    const reviewFirst = await this.systemConfig.bool(
      'payouts.review_first_payout',
      true,
    );

    if (!reviewFirst) {
      return false;
    }

    const paidCount = await this.prisma.payout.count({
      where: { organisationId, status: 'paid' },
    });

    return paidCount === 0;
  }
}
