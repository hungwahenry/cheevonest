import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { Broadcast } from '../../../../generated/prisma/client';
import { BroadcastNotCancellableException } from '../exceptions/broadcast-not-cancellable.exception';

export const ADMIN_BROADCAST_INCLUDE = {
  organisation: true,
  event: true,
  createdBy: { include: { profile: true } },
} satisfies Prisma.BroadcastInclude;

export type AdminBroadcast = Prisma.BroadcastGetPayload<{
  include: typeof ADMIN_BROADCAST_INCLUDE;
}>;

@Injectable()
export class BroadcastModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    status?: string;
  }): Promise<{ items: AdminBroadcast[]; total: number }> {
    const where: Prisma.BroadcastWhereInput = {
      ...(options.status
        ? { status: options.status as Broadcast['status'] }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.broadcast.count({ where }),
      this.prisma.broadcast.findMany({
        where,
        include: ADMIN_BROADCAST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async detail(broadcastId: string): Promise<AdminBroadcast> {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: ADMIN_BROADCAST_INCLUDE,
    });

    if (!broadcast) {
      throw new NotFoundException();
    }

    return broadcast;
  }

  /** Flips an in-flight broadcast to cancelled — the dispatcher stops between chunks. */
  async cancel(broadcastId: string): Promise<Broadcast> {
    const broadcast = await this.findOrFail(broadcastId);

    if (broadcast.status !== 'queued' && broadcast.status !== 'sending') {
      throw new BroadcastNotCancellableException(broadcast.status);
    }

    return this.prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: 'cancelled' },
    });
  }

  async findOrFail(broadcastId: string): Promise<Broadcast> {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      throw new NotFoundException();
    }

    return broadcast;
  }
}
