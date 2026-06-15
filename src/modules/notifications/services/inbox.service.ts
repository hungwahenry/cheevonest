import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Notification } from '../../../generated/prisma/client';
import { NotificationNotFoundException } from '../exceptions/notification-not-found.exception';
import {
  NotificationAudience,
  notificationTypesForAudience,
} from '../notification-types';

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async page(
    userId: string,
    audience: NotificationAudience,
    page: number,
    perPage: number,
  ): Promise<{ items: Notification[]; total: number }> {
    const where = {
      userId,
      type: { in: notificationTypesForAudience(audience) },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total };
  }

  async unreadCount(
    userId: string,
    audience: NotificationAudience,
  ): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        type: { in: notificationTypesForAudience(audience) },
      },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });

    if (updated.count === 0) {
      throw new NotificationNotFoundException();
    }
  }

  async markAllRead(
    userId: string,
    audience: NotificationAudience,
  ): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        type: { in: notificationTypesForAudience(audience) },
      },
      data: { readAt: new Date() },
    });
  }

  async hasUnreadOfTypeWithData(
    userId: string,
    type: string,
    dataPath: string,
    value: string,
  ): Promise<boolean> {
    const row = await this.prisma.notification.findFirst({
      where: {
        userId,
        type,
        readAt: null,
        data: { path: [dataPath], equals: value },
      },
      select: { id: true },
    });

    return row !== null;
  }
}
