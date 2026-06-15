import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { User } from '../../../generated/prisma/client';
import {
  NOTIFICATION_TYPES,
  NotificationAudience,
  NotificationChannel,
  NotificationType,
  notificationTypesForAudience,
} from '../notification-types';

export interface PreferenceCell {
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async channelsFor(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationChannel[]> {
    const meta = NOTIFICATION_TYPES[type];
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId, notificationType: type },
      select: { channel: true, enabled: true },
    });

    if (rows.length === 0) {
      return meta.defaultChannels;
    }

    const byChannel = new Map(rows.map((row) => [row.channel, row.enabled]));

    return meta.allowedChannels.filter((channel) => {
      const stored = byChannel.get(channel);

      return stored === undefined
        ? meta.defaultChannels.includes(channel)
        : stored;
    });
  }

  async matrix(
    userId: string,
    audience: NotificationAudience,
  ): Promise<PreferenceCell[]> {
    const stored = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const byKey = new Map(
      stored.map((row) => [
        `${row.notificationType}:${row.channel}`,
        row.enabled,
      ]),
    );

    return notificationTypesForAudience(audience).flatMap((type) =>
      NOTIFICATION_TYPES[type].allowedChannels.map((channel) => ({
        type,
        channel,
        enabled:
          byKey.get(`${type}:${channel}`) ??
          NOTIFICATION_TYPES[type].defaultChannels.includes(channel),
      })),
    );
  }

  async set(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<void> {
    if (!NOTIFICATION_TYPES[type].allowedChannels.includes(channel)) {
      return;
    }

    await this.prisma.notificationPreference.upsert({
      where: {
        userId_notificationType_channel: {
          userId,
          notificationType: type,
          channel,
        },
      },
      update: { enabled },
      create: { userId, notificationType: type, channel, enabled },
    });
  }

  async updateQuietHours(
    user: User,
    quietHours: {
      start: string | null;
      end: string | null;
      timezone: string | null;
    },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        quietHoursStart: quietHours.start,
        quietHoursEnd: quietHours.end,
        quietHoursTimezone: quietHours.timezone,
      },
    });
  }
}
