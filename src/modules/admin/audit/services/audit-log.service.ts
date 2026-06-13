import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import {
  ADMIN_ACTION_INCLUDE,
  AdminActionRow,
} from '../serializers/admin-action.serializer';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    action?: string;
    adminUserId?: string;
    targetType?: string;
    targetId?: string;
  }): Promise<{ items: AdminActionRow[]; total: number }> {
    const where: Prisma.AdminActionWhereInput = {
      ...(options.action ? { action: options.action } : {}),
      ...(options.adminUserId ? { adminUserId: options.adminUserId } : {}),
      ...(options.targetType ? { targetType: options.targetType } : {}),
      ...(options.targetId ? { targetId: options.targetId } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.adminAction.count({ where }),
      this.prisma.adminAction.findMany({
        where,
        include: ADMIN_ACTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  /** The recent admin actions taken on a specific entity — embedded in every 360 view. */
  async forTarget(
    targetType: string,
    targetId: string,
    take = 10,
  ): Promise<AdminActionRow[]> {
    return this.prisma.adminAction.findMany({
      where: { targetType, targetId },
      include: ADMIN_ACTION_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
