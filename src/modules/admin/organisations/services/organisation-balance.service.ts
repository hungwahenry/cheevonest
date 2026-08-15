import { Injectable } from '@nestjs/common';
import type { Organisation } from '../../../../generated/prisma/client';
import { LedgerService } from '../../../ledger/ledger.service';
import type { BalanceSummary } from '../../../payouts/services/balance.service';
import { BalanceService } from '../../../payouts/services/balance.service';
import { DebitExceedsBalanceException } from '../exceptions/debit-exceeds-balance.exception';

export type AdjustDirection = 'credit' | 'debit';

@Injectable()
export class OrganisationBalanceService {
  constructor(
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
      const summary = await this.balance.summary(organisation);
      if (amountMinor > summary.available_minor) {
        throw new DebitExceedsBalanceException(summary.available_minor);
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
}
