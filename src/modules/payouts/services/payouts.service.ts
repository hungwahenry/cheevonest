import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import type {
  Organisation,
  Payout,
  User,
} from '../../../generated/prisma/client';
import { lockInFlightPayouts } from '../../../generated/prisma/sql';
import { OrganisationSuspendedException } from '../../organisations/exceptions/organisation-suspended.exception';
import { InsufficientBalanceException } from '../exceptions/insufficient-balance.exception';
import { PayoutAccountMissingException } from '../exceptions/payout-account-missing.exception';
import { PayoutAlreadyInFlightException } from '../exceptions/payout-already-in-flight.exception';
import {
  PAYOUT_REJECTED,
  PayoutRejectedEvent,
} from '../events/payout-rejected.event';
import {
  PAYOUT_REQUESTED,
  PayoutRequestedEvent,
} from '../events/payout-requested.event';
import { PayoutRules } from '../rules/payout.rules';
import { BalanceService } from './balance.service';
import { PayoutFeesService } from './payout-fees.service';
import { PayoutProcessingService } from './payout-processing.service';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly fees: PayoutFeesService,
    private readonly rules: PayoutRules,
    private readonly emitter: EventEmitter2,
    private readonly processing: PayoutProcessingService,
  ) {}

  async request(
    organisation: Organisation,
    user: User,
    amountMinor: number,
  ): Promise<Payout> {
    if (organisation.suspendedAt != null) {
      throw new OrganisationSuspendedException();
    }
    await this.rules.ensureEnabled(user.id);

    const account = await this.prisma.payoutAccount.findUnique({
      where: { organisationId: organisation.id },
    });

    if (!account) {
      throw new PayoutAccountMissingException();
    }

    await this.rules.ensureAccountSettled(account);

    const [summary, feesMinor, needsReview] = await Promise.all([
      this.balance.summary(organisation),
      this.fees.transferFee(amountMinor),
      this.rules.requiresReview(organisation.id, amountMinor),
    ]);

    const payout = await this.prisma.$transaction(async (tx) => {
      const inFlight = await tx.$queryRawTyped(
        lockInFlightPayouts(organisation.id),
      );

      if (inFlight.length > 0) {
        throw new PayoutAlreadyInFlightException();
      }

      if (amountMinor > summary.available_minor) {
        throw new InsufficientBalanceException(summary.available_minor);
      }

      return tx.payout.create({
        data: {
          id: ulid(),
          organisationId: organisation.id,
          payoutAccountId: account.id,
          requestedByUserId: user.id,
          bankCode: account.bankCode,
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          accountName: account.accountName,
          amountMinor,
          feesMinor,
          netMinor: amountMinor - feesMinor,
          currency: 'NGN',
          status: needsReview ? 'pending_review' : 'requested',
          provider: account.provider,
          transferMethod: 'provider',
          requestedAt: new Date(),
        },
      });
    });

    await this.emitter.emitAsync(
      PAYOUT_REQUESTED,
      new PayoutRequestedEvent(payout.id, needsReview),
    );

    if (needsReview) {
      return payout;
    }

    return this.processing.initiateSafely(payout.id);
  }

  async approve(payout: Payout, admin: User): Promise<Payout> {
    this.rules.ensureReviewable(payout);

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        reviewedByUserId: admin.id,
      },
    });

    return this.processing.initiateSafely(payout.id);
  }

  async reject(payout: Payout, admin: User, notes?: string): Promise<Payout> {
    this.rules.ensureReviewable(payout);

    const rejected = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        reviewedByUserId: admin.id,
        reviewNotes: notes ?? null,
      },
    });

    await this.emitter.emitAsync(
      PAYOUT_REJECTED,
      new PayoutRejectedEvent(rejected.id),
    );

    return rejected;
  }

  async retry(payout: Payout, admin: User): Promise<Payout> {
    this.rules.ensureRetryable(payout);

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: { reviewedByUserId: admin.id },
    });

    return this.processing.initiate(payout.id);
  }

  async findOrFail(payoutId: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException();
    }

    return payout;
  }

  async findScoped(organisationId: string, payoutId: string): Promise<Payout> {
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, organisationId },
    });

    if (!payout) {
      throw new NotFoundException();
    }

    return payout;
  }

  async pageForOrganisation(
    organisationId: string,
    page: number,
    perPage: number,
  ): Promise<{ items: Payout[]; total: number }> {
    const where = { organisationId };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.payout.count({ where }),
      this.prisma.payout.findMany({
        where,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total };
  }
}
