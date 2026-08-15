import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type {
  Organisation,
  PayoutStatus,
} from '../../../../generated/prisma/client';
import { LedgerService } from '../../../ledger/ledger.service';
import type { BalanceSummary } from '../../../payouts/services/balance.service';
import { BalanceService } from '../../../payouts/services/balance.service';
import { IN_FLIGHT_PAYOUT_STATUSES } from '../../../payouts/payout.constants';
import { DebitExceedsBalanceException } from '../exceptions/debit-exceeds-balance.exception';

export type AdjustDirection = 'credit' | 'debit';

const SPENT_PAYOUT_STATUSES: PayoutStatus[] = [
  ...IN_FLIGHT_PAYOUT_STATUSES,
  'paid',
];

@Injectable()
export class OrganisationBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly balance: BalanceService,
  ) {}

  async adjust(
    organisation: Organisation,
    direction: AdjustDirection,
    amountMinor: number,
    note: string,
  ): Promise<BalanceSummary> {
    if (direction === 'debit') {
      const debitable = await this.debitable(organisation.id);
      if (amountMinor > debitable) {
        throw new DebitExceedsBalanceException(debitable);
      }
    }

    await this.ledger.recordAdjustment({
      organisationId: organisation.id,
      amountMinor: direction === 'credit' ? amountMinor : -amountMinor,
      currency: 'NGN',
      note,
    });

    return this.balance.summary(organisation);
  }

  /** Everything the organiser holds that isn't already paid out or in-flight. */
  private async debitable(organisationId: string): Promise<number> {
    const [earnings, spent] = await Promise.all([
      this.ledger.earnings(organisationId),
      this.prisma.payout.aggregate({
        where: { organisationId, status: { in: SPENT_PAYOUT_STATUSES } },
        _sum: { amountMinor: true },
      }),
    ]);

    return (
      earnings.availableMinor +
      earnings.pendingMinor -
      Number(spent._sum.amountMinor ?? 0n)
    );
  }
}
