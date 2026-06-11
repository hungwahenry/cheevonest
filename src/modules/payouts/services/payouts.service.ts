import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ulid } from 'ulid';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type {
  Organisation,
  Payout,
  PayoutAccount,
  User,
} from '../../../generated/prisma/client';
import {
  lockInFlightPayouts,
  lockPayoutByProviderReference,
} from '../../../generated/prisma/sql';
import {
  PaymentProvider,
  TransferWebhookEvent,
} from '../../payments/contracts/payment-provider.interface';
import { PaymentProviderRegistry } from '../../payments/services/payment-provider-registry.service';
import { FeatureFlagsService } from '../../platform/system-config/feature-flags.service';
import { InsufficientBalanceException } from '../exceptions/insufficient-balance.exception';
import { PayoutAccountMissingException } from '../exceptions/payout-account-missing.exception';
import { PayoutAlreadyInFlightException } from '../exceptions/payout-already-in-flight.exception';
import { PayoutNotApprovableException } from '../exceptions/payout-not-approvable.exception';
import { PayoutNotPayableException } from '../exceptions/payout-not-payable.exception';
import { PayoutNotRejectableException } from '../exceptions/payout-not-rejectable.exception';
import { PayoutNotRetryableException } from '../exceptions/payout-not-retryable.exception';
import { PayoutsDisabledException } from '../exceptions/payouts-disabled.exception';
import {
  PAYOUT_SETTLED,
  PayoutSettledEvent,
} from '../events/payout-settled.event';
import { BalanceService } from './balance.service';
import { PayoutFeesService } from './payout-fees.service';

const TERMINAL_STATUSES = ['paid', 'rejected', 'failed'];

export type TransferMethod = 'provider' | 'manual';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PaymentProviderRegistry,
    private readonly balance: BalanceService,
    private readonly fees: PayoutFeesService,
    private readonly features: FeatureFlagsService,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async request(
    organisation: Organisation,
    user: User,
    amountMinor: number,
  ): Promise<Payout> {
    if (
      !(await this.features.enabled('payouts.enabled', { userId: user.id }))
    ) {
      throw new PayoutsDisabledException();
    }

    const account = await this.prisma.payoutAccount.findUnique({
      where: { organisationId: organisation.id },
    });

    if (!account) {
      throw new PayoutAccountMissingException();
    }

    const [summary, feesMinor] = await Promise.all([
      this.balance.summary(organisation),
      this.fees.transferFee(amountMinor),
    ]);

    return this.prisma.$transaction(async (tx) => {
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
          status: 'requested',
          provider: account.provider,
          requestedAt: new Date(),
        },
      });
    });
  }

  /** Provider flow: approve and push the transfer to the provider in one step. */
  async approveWithProvider(
    payout: Payout,
    admin: User,
    note: string | null,
  ): Promise<Payout> {
    await this.markApproved(payout, admin, note, 'provider');

    return this.initiate(payout.id);
  }

  /** Manual flow: approve only — money moves by hand, then mark-paid closes it. */
  async approveManually(
    payout: Payout,
    admin: User,
    note: string | null,
  ): Promise<Payout> {
    return this.markApproved(payout, admin, note, 'manual');
  }

  async reject(payout: Payout, admin: User, note: string): Promise<Payout> {
    if (!['requested', 'approved'].includes(payout.status)) {
      throw new PayoutNotRejectableException(payout.status);
    }

    const rejected = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        reviewedByUserId: admin.id,
        reviewNotes: note,
      },
    });

    await this.emitter.emitAsync(
      PAYOUT_SETTLED,
      new PayoutSettledEvent(rejected.id),
    );

    return rejected;
  }

  async markPaid(payout: Payout, admin: User, note: string): Promise<Payout> {
    if (!['approved', 'processing'].includes(payout.status)) {
      throw new PayoutNotPayableException(payout.status);
    }

    const paid = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        reviewedByUserId: admin.id,
        reviewNotes: note,
      },
    });

    await this.emitter.emitAsync(
      PAYOUT_SETTLED,
      new PayoutSettledEvent(paid.id),
    );

    return paid;
  }

  async retry(payout: Payout, admin: User): Promise<Payout> {
    if (payout.status !== 'failed' || payout.transferMethod !== 'provider') {
      throw new PayoutNotRetryableException(payout.status);
    }

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: { reviewedByUserId: admin.id },
    });

    return this.initiate(payout.id);
  }

  /**
   * Push the transfer to the provider and persist the acknowledgement; the
   * payout flips to processing — real success/failure arrives via webhook.
   */
  async initiate(payoutId: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
      include: { account: true },
    });

    const provider = this.registry.get(payout.provider);
    const reference = payout.providerReference ?? `po_${ulid().toLowerCase()}`;

    const initiated = await provider.transfer({
      amountMinor: Number(payout.netMinor),
      currency: payout.currency,
      reference,
      reason: `${this.config.get('APP_NAME', { infer: true })} payout ${payout.id}`,
      recipientCode: await this.ensureRecipientCode(payout.account, provider),
      bankCode: payout.bankCode,
      accountNumber: payout.accountNumber,
      accountName: payout.accountName,
    });

    return this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'processing',
        providerReference: reference,
        providerResponse: initiated.providerResponse as Prisma.InputJsonValue,
        failedAt: null,
        failedReason: null,
      },
    });
  }

  /** Applies a provider transfer event to the matching payout exactly once. */
  async finalize(event: TransferWebhookEvent): Promise<Payout | null> {
    const settled = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawTyped(
        lockPayoutByProviderReference(event.reference),
      );

      if (locked.length === 0) {
        this.logger.warn(
          `transfer webhook matched no payout: ${event.reference}`,
        );

        return null;
      }

      const payout = await tx.payout.findUniqueOrThrow({
        where: { id: locked[0].id },
      });

      if (TERMINAL_STATUSES.includes(payout.status)) {
        return payout;
      }

      return tx.payout.update({
        where: { id: payout.id },
        data: {
          status: event.status,
          providerResponse: event.providerResponse as Prisma.InputJsonValue,
          paidAt: event.status === 'paid' ? new Date() : payout.paidAt,
          failedAt: event.status === 'failed' ? new Date() : null,
          failedReason: event.failureReason,
        },
      });
    });

    if (settled && ['paid', 'failed'].includes(settled.status)) {
      await this.emitter.emitAsync(
        PAYOUT_SETTLED,
        new PayoutSettledEvent(settled.id),
      );
    }

    return settled;
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
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total };
  }

  private async markApproved(
    payout: Payout,
    admin: User,
    note: string | null,
    method: TransferMethod,
  ): Promise<Payout> {
    if (payout.status !== 'requested') {
      throw new PayoutNotApprovableException(payout.status);
    }

    return this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        reviewedByUserId: admin.id,
        reviewNotes: note,
        transferMethod: method,
      },
    });
  }

  private async ensureRecipientCode(
    account: PayoutAccount | null,
    provider: PaymentProvider,
  ): Promise<string | null> {
    if (!account || account.providerRecipientCode !== null) {
      return account?.providerRecipientCode ?? null;
    }

    const code = await provider.createTransferRecipient({
      name: account.accountName,
      accountNumber: account.accountNumber,
      bankCode: account.bankCode,
      currency: account.currency,
    });

    if (code !== null) {
      await this.prisma.payoutAccount.update({
        where: { id: account.id },
        data: { providerRecipientCode: code },
      });
    }

    return code;
  }
}
