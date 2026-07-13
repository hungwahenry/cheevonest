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
  User,
} from '../../../generated/prisma/client';
import {
  lockInFlightPayouts,
  lockPayoutByProviderReference,
} from '../../../generated/prisma/sql';
import { TransferWebhookEvent } from '../../payments/contracts/payment-provider.interface';
import { PaymentProviderRegistry } from '../../payments/services/payment-provider-registry.service';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { OrganisationSuspendedException } from '../../organisations/exceptions/organisation-suspended.exception';
import { InsufficientBalanceException } from '../exceptions/insufficient-balance.exception';
import { PayoutAccountMissingException } from '../exceptions/payout-account-missing.exception';
import { PayoutAlreadyInFlightException } from '../exceptions/payout-already-in-flight.exception';
import {
  PAYOUT_SETTLED,
  PayoutSettledEvent,
} from '../events/payout-settled.event';
import { PayoutRules } from '../rules/payout.rules';
import { BalanceService } from './balance.service';
import { PayoutFeesService } from './payout-fees.service';

const TERMINAL_STATUSES = ['paid', 'rejected', 'failed'];

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PaymentProviderRegistry,
    private readonly balance: BalanceService,
    private readonly fees: PayoutFeesService,
    private readonly rules: PayoutRules,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService<Env, true>,
    private readonly systemConfig: SystemConfigService,
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

    const [summary, feesMinor] = await Promise.all([
      this.balance.summary(organisation),
      this.fees.transferFee(amountMinor),
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
          status: 'requested',
          provider: account.provider,
          transferMethod: 'provider',
          requestedAt: new Date(),
        },
      });
    });

    // Push the transfer to the provider immediately — no admin approval step.
    return this.initiateSafely(payout.id);
  }

  async retry(payout: Payout, admin: User): Promise<Payout> {
    this.rules.ensureRetryable(payout);

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

    // Persist the reference before sending so a null reference proves un-sent.
    if (payout.providerReference === null) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: { providerReference: reference },
      });
    }

    const initiated = await provider.transfer({
      amountMinor: Number(payout.netMinor),
      currency: payout.currency,
      reference,
      reason: `${this.config.get('APP_NAME', { infer: true })} payout ${payout.id}`,
      recipientCode: payout.account?.providerRecipientCode ?? null,
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

      // A reversal can undo an already-paid payout, so it bypasses the guard.
      if (event.status === 'reversed') {
        if (payout.status === 'failed' || payout.status === 'rejected') {
          return { payout, changed: false };
        }

        const reversed = await tx.payout.update({
          where: { id: payout.id },
          data: {
            status: 'failed',
            paidAt: null,
            failedAt: new Date(),
            failedReason: event.failureReason ?? 'Transfer reversed by provider',
            providerResponse: event.providerResponse as Prisma.InputJsonValue,
          },
        });

        return { payout: reversed, changed: true };
      }

      if (TERMINAL_STATUSES.includes(payout.status)) {
        return { payout, changed: false };
      }

      const updated = await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: event.status,
          providerResponse: event.providerResponse as Prisma.InputJsonValue,
          paidAt: event.status === 'paid' ? new Date() : payout.paidAt,
          failedAt: event.status === 'failed' ? new Date() : null,
          failedReason: event.failureReason,
        },
      });

      return { payout: updated, changed: true };
    });

    if (!settled) {
      return null;
    }

    if (
      settled.changed &&
      ['paid', 'failed'].includes(settled.payout.status)
    ) {
      await this.emitter.emitAsync(
        PAYOUT_SETTLED,
        new PayoutSettledEvent(settled.payout.id),
      );
    }

    return settled.payout;
  }

  /** Pull-verify a payout's transfer with the provider and settle it if terminal. */
  async reconcile(payout: Payout): Promise<Payout | null> {
    if (payout.providerReference === null) {
      return payout;
    }

    const provider = this.registry.get(payout.provider);
    const event = await provider.verifyTransfer(payout.providerReference);

    if (!event) {
      return payout;
    }

    return this.finalize(event);
  }

  /** Recovers stranded payouts: un-sent rows are initiated, the rest pull-verified. */
  async sweepStuck(): Promise<{ initiated: number; reconciled: number }> {
    const staleMinutes = await this.systemConfig.int(
      'payouts.reconcile_stale_minutes',
      15,
    );
    const cutoff = new Date(Date.now() - staleMinutes * 60_000);

    const uninitiated = await this.prisma.payout.findMany({
      where: {
        status: 'requested',
        providerReference: null,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });

    for (const { id } of uninitiated) {
      await this.initiateSafely(id);
    }

    const unresolved = await this.prisma.payout.findMany({
      where: {
        status: { in: ['requested', 'processing'] },
        providerReference: { not: null },
        updatedAt: { lt: cutoff },
      },
    });

    for (const payout of unresolved) {
      try {
        await this.reconcile(payout);
      } catch (error) {
        this.logger.warn(
          `reconcile failed for payout ${payout.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return { initiated: uninitiated.length, reconciled: unresolved.length };
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

  /** Wraps initiate() so a provider failure parks the payout as failed instead of throwing. */
  private async initiateSafely(payoutId: string): Promise<Payout> {
    try {
      return await this.initiate(payoutId);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'transfer initiation failed';
      this.logger.error(`payout ${payoutId} initiation failed: ${reason}`);

      return this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'failed', failedAt: new Date(), failedReason: reason },
      });
    }
  }

}
