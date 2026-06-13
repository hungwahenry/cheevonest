import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { BroadcastSuppression } from '../../../../generated/prisma/client';

@Injectable()
export class AdminSuppressionsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    search?: string;
    reason?: string;
  }): Promise<{ items: BroadcastSuppression[]; total: number }> {
    const search = options.search?.trim() ?? '';

    const where: Prisma.BroadcastSuppressionWhereInput = {
      ...(options.reason
        ? { reason: options.reason as BroadcastSuppression['reason'] }
        : {}),
      ...(search !== ''
        ? { email: { contains: search, mode: 'insensitive' } }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.broadcastSuppression.count({ where }),
      this.prisma.broadcastSuppression.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async delete(suppressionId: string): Promise<BroadcastSuppression> {
    const suppression = await this.prisma.broadcastSuppression.findUnique({
      where: { id: suppressionId },
    });

    if (!suppression) {
      throw new NotFoundException();
    }

    await this.prisma.broadcastSuppression.delete({
      where: { id: suppressionId },
    });

    return suppression;
  }
}
