import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { Currency } from '../../generated/prisma/client';
import { SystemConfigService } from '../platform/system-config/system-config.service';

const DAY_MS = 86_400_000;

export interface SaleInput {
  organisationId: string;
  orderId: string;
  amountMinor: number;
  currency: Currency;
  paidAt: Date;
}

export interface RefundInput {
  organisationId: string;
  orderId: string;
  amountMinor: number;
  currency: Currency;
}

export interface Earnings {
  availableMinor: number;
  pendingMinor: number;
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async recordSale(
    tx: Prisma.TransactionClient,
    input: SaleInput,
  ): Promise<void> {
    const holdDays = await this.systemConfig.int('payouts.hold_window_days', 2);

    await tx.ledgerEntry.create({
      data: {
        id: ulid(),
        organisationId: input.organisationId,
        type: 'sale',
        amountMinor: BigInt(input.amountMinor),
        currency: input.currency,
        sourceType: 'order',
        sourceId: input.orderId,
        availableAt: new Date(input.paidAt.getTime() + holdDays * DAY_MS),
      },
    });
  }

  /** Reverses a sale in the same maturity bucket so a refunded order nets to zero. */
  async recordRefund(
    tx: Prisma.TransactionClient,
    input: RefundInput,
  ): Promise<void> {
    const sale = await tx.ledgerEntry.findFirst({
      where: { sourceType: 'order', sourceId: input.orderId, type: 'sale' },
      select: { availableAt: true },
    });

    await tx.ledgerEntry.create({
      data: {
        id: ulid(),
        organisationId: input.organisationId,
        type: 'refund',
        amountMinor: -BigInt(input.amountMinor),
        currency: input.currency,
        sourceType: 'order',
        sourceId: input.orderId,
        availableAt: sale?.availableAt ?? new Date(),
      },
    });
  }

  /** Matured (withdrawable) and still-held net earnings for an organisation. */
  async earnings(organisationId: string): Promise<Earnings> {
    const now = new Date();

    const [matured, held] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { organisationId, availableAt: { lte: now } },
        _sum: { amountMinor: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { organisationId, availableAt: { gt: now } },
        _sum: { amountMinor: true },
      }),
    ]);

    return {
      availableMinor: Number(matured._sum.amountMinor ?? 0n),
      pendingMinor: Number(held._sum.amountMinor ?? 0n),
    };
  }
}
