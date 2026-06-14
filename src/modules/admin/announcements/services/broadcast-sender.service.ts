import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { AdminBroadcast } from '../../../../generated/prisma/client';
import { Env } from '../../../../config/env';
import { UrlSignerService } from '../../../../common/signing/url-signer.service';
import { MailService } from '../../../../integrations/mail/mail.service';
import {
  ExpoPushMessage,
  ExpoPushService,
} from '../../../../integrations/push/expo-push.service';
import { isInQuietHours } from '../../../notifications/services/quiet-hours';
import {
  AudienceSegmentService,
  SegmentDefinition,
} from './audience-segment.service';

const USER_CHUNK = 500;
const UNSUBSCRIBE_TTL_SECONDS = 90 * 24 * 3600;
const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g;

export interface BroadcastSendStats {
  recipients: number;
  email: number;
  push: number;
  inapp: number;
  failed: number;
}

type BroadcastRecipient = Prisma.UserGetPayload<{
  include: { expoPushTokens: { select: { token: true } } };
}>;

@Injectable()
export class BroadcastSenderService {
  private readonly logger = new Logger(BroadcastSenderService.name);
  private readonly appUrl: string;
  private readonly fromAddress: string;
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly segments: AudienceSegmentService,
    private readonly expo: ExpoPushService,
    private readonly mail: MailService,
    private readonly signer: UrlSignerService,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/$/, '');
    this.fromAddress = config.get('MAIL_FROM_ADDRESS', { infer: true });
    this.appName = config.get('APP_NAME', { infer: true });
  }

  /** Fans a persisted broadcast out across its channels; returns delivery counts. */
  async deliver(broadcast: AdminBroadcast): Promise<BroadcastSendStats> {
    const marketing = broadcast.kind === 'marketing';
    const channels = new Set(broadcast.channels);
    const segment = broadcast.audience as SegmentDefinition;
    const where = this.segments.where(segment, {
      requireMarketingConsent: marketing,
    });

    const bodyHtml = marketing
      ? await this.trackedBodyHtml(broadcast.id, broadcast.body)
      : this.plainBodyHtml(broadcast.body);

    const stats: BroadcastSendStats = {
      recipients: 0,
      email: 0,
      push: 0,
      inapp: 0,
      failed: 0,
    };

    let cursor: string | undefined;

    for (;;) {
      const users = await this.prisma.user.findMany({
        where,
        include: { expoPushTokens: { select: { token: true } } },
        orderBy: { id: 'asc' },
        take: USER_CHUNK,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (users.length === 0) {
        break;
      }

      stats.recipients += users.length;

      if (channels.has('inapp')) {
        stats.inapp += await this.sendInapp(broadcast, users);
      }

      if (channels.has('push')) {
        stats.push += await this.sendPush(broadcast, users, marketing);
      }

      if (channels.has('email')) {
        const { sent, failed } = await this.sendEmail(
          broadcast,
          users,
          bodyHtml,
          marketing,
        );
        stats.email += sent;
        stats.failed += failed;
      }

      cursor = users[users.length - 1].id;

      if (users.length < USER_CHUNK) {
        break;
      }
    }

    return stats;
  }

  private async sendInapp(
    broadcast: AdminBroadcast,
    users: BroadcastRecipient[],
  ): Promise<number> {
    const rows: Prisma.NotificationCreateManyInput[] = users.map((user) => ({
      id: ulid(),
      userId: user.id,
      type: 'admin.broadcast',
      data: {
        type: 'admin.broadcast',
        kind: broadcast.kind,
        broadcastId: broadcast.id,
        title: broadcast.title,
        body: broadcast.body,
      },
    }));

    await this.prisma.notification.createMany({ data: rows });

    return rows.length;
  }

  private async sendPush(
    broadcast: AdminBroadcast,
    users: BroadcastRecipient[],
    marketing: boolean,
  ): Promise<number> {
    const messages: ExpoPushMessage[] = [];
    const data = { type: 'admin.broadcast', broadcastId: broadcast.id };

    for (const user of users) {
      if (marketing && isInQuietHours(user)) {
        continue;
      }

      for (const { token } of user.expoPushTokens) {
        messages.push({
          to: token,
          title: broadcast.title,
          body: broadcast.body,
          data,
        });
      }
    }

    await this.expo.send(messages);

    return messages.length;
  }

  private async sendEmail(
    broadcast: AdminBroadcast,
    users: BroadcastRecipient[],
    bodyHtml: string,
    marketing: boolean,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      const unsubscribeUrl = marketing
        ? this.signer.sign(
            `/unsubscribe/marketing/${user.id}`,
            UNSUBSCRIBE_TTL_SECONDS,
          )
        : null;

      try {
        await this.mail.send({
          to: user.email,
          subject: broadcast.title,
          template: 'system-announcement',
          context: {
            title: broadcast.title,
            bodyHtml,
            unsubscribeUrl,
          },
          from: `${this.appName} <${this.fromAddress}>`,
          ...(unsubscribeUrl
            ? {
                headers: {
                  'List-Unsubscribe': `<${unsubscribeUrl}>`,
                  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                },
              }
            : {}),
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    return { sent, failed };
  }

  /** Replaces URLs in the body with click-tracked redirects, persisting each link. */
  private async trackedBodyHtml(
    broadcastId: string,
    body: string,
  ): Promise<string> {
    const urls = [...new Set(body.match(URL_PATTERN) ?? [])];
    const redirect = new Map<string, string>();

    for (const url of urls) {
      const id = ulid();
      await this.prisma.adminBroadcastLink.create({
        data: { id, broadcastId, url },
      });
      redirect.set(url, `${this.appUrl}/r/${id}`);
    }

    return this.bodyHtml(body, redirect);
  }

  private plainBodyHtml(body: string): string {
    return this.bodyHtml(body, new Map());
  }

  private bodyHtml(body: string, redirect: Map<string, string>): string {
    return body
      .split(/\n{2,}/)
      .map((paragraph) => {
        const lines = paragraph
          .split('\n')
          .map((line) => this.renderLine(line, redirect))
          .join('<br>');

        return `<p style="margin:0 0 16px;">${lines}</p>`;
      })
      .join('');
  }

  private renderLine(line: string, redirect: Map<string, string>): string {
    let cursor = 0;
    let out = '';

    for (const match of line.matchAll(URL_PATTERN)) {
      const url = match[0];
      const start = match.index ?? 0;
      out += this.escape(line.slice(cursor, start));
      const href = redirect.get(url) ?? url;
      out += `<a href="${this.escape(href)}">${this.escape(url)}</a>`;
      cursor = start + url.length;
    }

    out += this.escape(line.slice(cursor));

    return out;
  }

  private escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
