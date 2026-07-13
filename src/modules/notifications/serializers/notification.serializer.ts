import { Injectable } from '@nestjs/common';
import type { Notification, User } from '../../../generated/prisma/client';
import {
  CHANNEL_LABELS,
  NOTIFICATION_TYPES,
  NotificationAudience,
  notificationTypesForAudience,
} from '../notification-types';
import { PreferenceCell } from '../services/notification-preferences.service';

const AUDIENCE_LABELS: Record<NotificationAudience, string> = {
  organizer: 'Organizer',
  attendee: 'Attendee',
  admin: 'Admin',
};

@Injectable()
export class NotificationSerializer {
  inboxItem(notification: Notification): Record<string, unknown> {
    const raw = (notification.data ?? {}) as Record<string, unknown>;
    const { title = null, body = null, ...payload } = raw;
    delete payload.type;

    return {
      id: notification.id,
      type: notification.type,
      title,
      body,
      data: payload,
      read_at: notification.readAt?.toISOString() ?? null,
      created_at: notification.createdAt.toISOString(),
    };
  }

  preferences(
    user: User,
    matrix: PreferenceCell[],
    audience: NotificationAudience,
  ): Record<string, unknown> {
    return {
      audiences: [{ value: audience, label: AUDIENCE_LABELS[audience] }],
      types: notificationTypesForAudience(audience).map((type) => {
        const meta = NOTIFICATION_TYPES[type];

        return {
          type,
          label: meta.label,
          description: meta.description,
          audience: meta.audience,
          channels: meta.allowedChannels.map((channel) => ({
            channel,
            label: CHANNEL_LABELS[channel],
            enabled:
              matrix.find(
                (cell) => cell.type === type && cell.channel === channel,
              )?.enabled ?? false,
          })),
        };
      }),
      quiet_hours: {
        start: user.quietHoursStart,
        end: user.quietHoursEnd,
        timezone: user.quietHoursTimezone,
      },
    };
  }
}
