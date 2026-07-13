import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Organisation } from '../../../generated/prisma/client';
import { LedgerService } from '../../ledger/ledger.service';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { IN_FLIGHT_PAYOUT_STATUSES } from '../payout.constants';

export interface BalanceSummary {
  currency: string;
  available_minor: number;
  pending_minor: number;
  paid_out_minor: number;
  hold_window_days: number;
  has_in_flight_payout: boolean;
  per_event: Array<{
    event_id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    status: string;
    revenue_minor: number;
  }>;
}

@Injectable()
export class BalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async summary(organisation: Organisation): Promise<BalanceSummary> {
    const holdDays = await this.systemConfig.int('payouts.hold_window_days', 2);

    const [earnings, inFlight, paidOut, events] = await Promise.all([
      this.ledger.earnings(organisation.id),
      this.prisma.payout.aggregate({
        where: {
          organisationId: organisation.id,
          status: { in: [...IN_FLIGHT_PAYOUT_STATUSES] },
        },
        _sum: { amountMinor: true },
        _count: true,
      }),
      this.prisma.payout.aggregate({
        where: { organisationId: organisation.id, status: 'paid' },
        _sum: { amountMinor: true },
      }),
      this.prisma.event.findMany({
        where: { organisationId: organisation.id, revenueMinor: { gt: 0 } },
        orderBy: { endsAt: { sort: 'desc', nulls: 'last' } },
      }),
    ]);

    const inFlightMinor = Number(inFlight._sum.amountMinor ?? 0n);
    const paidOutMinor = Number(paidOut._sum.amountMinor ?? 0n);

    return {
      currency: 'NGN',
      available_minor: Math.max(
        0,
        earnings.availableMinor - inFlightMinor - paidOutMinor,
      ),
      pending_minor: earnings.pendingMinor + inFlightMinor,
      paid_out_minor: paidOutMinor,
      hold_window_days: holdDays,
      has_in_flight_payout: inFlight._count > 0,
      per_event: events.map((event) => ({
        event_id: event.id,
        title: event.title,
        starts_at: event.startsAt?.toISOString() ?? null,
        ends_at: event.endsAt?.toISOString() ?? null,
        status: event.status,
        revenue_minor: Number(event.revenueMinor),
      })),
    };
  }
}
