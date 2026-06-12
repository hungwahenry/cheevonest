import { Injectable, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { MailService } from '../../../integrations/mail/mail.service';
import { FeatureFlagsService } from '../../platform/system-config/feature-flags.service';
import { NotificationMessage } from '../contracts/notification-message.interface';
import { ExpoPushMessage, ExpoPushService } from './expo-push.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { isInQuietHours } from './quiet-hours';

@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
    private readonly expo: ExpoPushService,
    private readonly mail: MailService,
    private readonly features: FeatureFlagsService,
  ) {}

  /** Fans a message out to users, honouring per-type channel prefs and quiet hours. */
  async send(userIds: string[], message: NotificationMessage): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      include: { expoPushTokens: { select: { token: true } } },
    });

    const inappRows: Prisma.NotificationCreateManyInput[] = [];
    const pushMessages: ExpoPushMessage[] = [];
    const data = { type: message.type, ...message.data() };
    const push = message.push();
    const inappData = push
      ? { ...data, title: push.title, body: push.body }
      : data;

    for (const user of users) {
      let channels = await this.preferences.channelsFor(user.id, message.type);

      if (isInQuietHours(user)) {
        channels = channels.filter((channel) => channel !== 'push');
      }

      if (channels.includes('inapp')) {
        inappRows.push({
          id: ulid(),
          userId: user.id,
          type: message.type,
          data: inappData,
        });
      }

      if (channels.includes('push') && user.expoPushTokens.length > 0) {
        const payload = push;

        if (
          payload &&
          (await this.features.enabled('notifications.push', {
            userId: user.id,
          }))
        ) {
          for (const { token } of user.expoPushTokens) {
            pushMessages.push({ to: token, ...payload, data });
          }
        }
      }

      if (channels.includes('email')) {
        const payload = message.mail();

        if (payload) {
          try {
            await this.mail.send({ to: user.email, ...payload });
          } catch (error) {
            this.logger.warn(
              `notification mail to ${user.email} failed: ${String(error)}`,
            );
          }
        }
      }
    }

    if (inappRows.length > 0) {
      await this.prisma.notification.createMany({ data: inappRows });
    }

    if (pushMessages.length > 0) {
      await this.expo.send(pushMessages);
    }
  }

  async sendToOrganisation(
    organisationId: string,
    message: NotificationMessage,
  ): Promise<void> {
    const members = await this.prisma.organisationMember.findMany({
      where: { organisationId },
      select: { userId: true },
    });

    await this.send(
      members.map((member) => member.userId),
      message,
    );
  }
}
