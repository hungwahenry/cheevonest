import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { PayoutStatus } from '../../../generated/prisma/client';
import { ADMIN_PAYOUT_INCLUDE, AdminPayout } from './admin-payout.serializer';

export interface AdminPayoutFilters {
  page: number;
  perPage: number;
  status?: PayoutStatus;
  organisationId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AdminPayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(
    filters: AdminPayoutFilters,
  ): Promise<{ items: AdminPayout[]; total: number }> {
    const where: Prisma.PayoutWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.organisationId
        ? { organisationId: filters.organisationId }
        : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.payout.count({ where }),
      this.prisma.payout.findMany({
        where,
        include: ADMIN_PAYOUT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
    ]);

    return { items, total };
  }

  async loadOne(payoutId: string): Promise<AdminPayout> {
    return this.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
      include: ADMIN_PAYOUT_INCLUDE,
    });
  }
}
