import { Injectable, NotFoundException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import type {
  Broadcast,
  BroadcastAudience,
  Event,
  User,
} from '../../../generated/prisma/client';
import { ensureEventNotEnded } from '../../events/rules/event.rules';
import { FeatureFlagsService } from '../../platform/system-config/feature-flags.service';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { BroadcastAudienceEmptyException } from '../exceptions/broadcast-audience-empty.exception';
import { BroadcastCooldownActiveException } from '../exceptions/broadcast-cooldown-active.exception';
import { BroadcastDailyCapReachedException } from '../exceptions/broadcast-daily-cap-reached.exception';
import { BroadcastLimitReachedException } from '../exceptions/broadcast-limit-reached.exception';
import { BroadcastsDisabledException } from '../exceptions/broadcasts-disabled.exception';
import { BroadcastDispatcherService } from './broadcast-dispatcher.service';
import { BroadcastMailerService } from './broadcast-mailer.service';
import { BroadcastRecipientsService } from './broadcast-recipients.service';

const COMMITTED_STATUSES = ['queued', 'sending', 'sent'] as const;

export interface BroadcastInput {
  audience: BroadcastAudience;
  subject: string;
  body_html: string;
}

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureFlagsService,
    private readonly systemConfig: SystemConfigService,
    private readonly recipients: BroadcastRecipientsService,
    private readonly dispatcher: BroadcastDispatcherService,
    private readonly mailer: BroadcastMailerService,
  ) {}

  async create(
    event: Event,
    user: User,
    input: BroadcastInput,
  ): Promise<Broadcast> {
    if (
      !(await this.features.enabled('broadcasts.enabled', { userId: user.id }))
    ) {
      throw new BroadcastsDisabledException();
    }

    ensureEventNotEnded(event);
    await this.ensureWithinPerEventLimit(event);
    await this.ensureCooldownPassed(event);
    await this.ensureDailyCapNotReached(event.organisationId);

    const recipients = await this.recipients.resolve(event, input.audience);

    if (recipients.length === 0) {
      throw new BroadcastAudienceEmptyException();
    }

    const bodyHtml = this.sanitize(input.body_html);

    const broadcast = await this.prisma.broadcast.create({
      data: {
        id: ulid(),
        organisationId: event.organisationId,
        eventId: event.id,
        createdByUserId: user.id,
        audience: input.audience,
        subject: input.subject,
        bodyHtml,
        bodyText: this.htmlToPlainText(bodyHtml),
        recipientsCount: recipients.length,
        status: 'queued',
      },
    });

    this.dispatcher.kickOff(broadcast.id);

    return broadcast;
  }

  /** Sends the composed mail to the requesting organiser only — nothing persisted. */
  async sendTest(
    event: Event,
    user: User,
    input: BroadcastInput,
  ): Promise<void> {
    ensureEventNotEnded(event);

    const organisation = await this.prisma.organisation.findUniqueOrThrow({
      where: { id: event.organisationId },
    });

    const bodyHtml = this.sanitize(input.body_html);

    await this.mailer.send({
      to: user.email,
      subject: `[TEST] ${input.subject}`,
      bodyHtml,
      bodyText: this.htmlToPlainText(bodyHtml),
      organisation,
      event,
    });
  }

  async findScoped(eventId: string, broadcastId: string): Promise<Broadcast> {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId, eventId },
    });

    if (!broadcast) {
      throw new NotFoundException();
    }

    return broadcast;
  }

  async pageForEvent(
    eventId: string,
    page: number,
    perPage: number,
  ): Promise<{ items: Broadcast[]; total: number }> {
    const where = { eventId };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.broadcast.count({ where }),
      this.prisma.broadcast.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total };
  }

  private async ensureWithinPerEventLimit(event: Event): Promise<void> {
    const limit = await this.systemConfig.int('broadcasts.max_per_event', 3);

    const existing = await this.prisma.broadcast.count({
      where: { eventId: event.id, status: { in: [...COMMITTED_STATUSES] } },
    });

    if (existing >= limit) {
      throw new BroadcastLimitReachedException(limit);
    }
  }

  private async ensureCooldownPassed(event: Event): Promise<void> {
    const cooldownMinutes = await this.systemConfig.int(
      'broadcasts.cooldown_minutes',
      720,
    );

    const latest = await this.prisma.broadcast.findFirst({
      where: { eventId: event.id, status: { in: [...COMMITTED_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return;
    }

    const unlockAt = new Date(
      latest.createdAt.getTime() + cooldownMinutes * 60_000,
    );

    if (unlockAt > new Date()) {
      throw new BroadcastCooldownActiveException(unlockAt.toISOString());
    }
  }

  private async ensureDailyCapNotReached(
    organisationId: string,
  ): Promise<void> {
    const cap = await this.systemConfig.int(
      'broadcasts.daily_volume_cap_per_org',
      5000,
    );

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const sentToday = await this.prisma.broadcast.aggregate({
      where: { organisationId, createdAt: { gte: dayStart } },
      _sum: { recipientsCount: true },
    });

    if ((sentToday._sum.recipientsCount ?? 0) >= cap) {
      throw new BroadcastDailyCapReachedException(cap);
    }
  }

  private sanitize(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: [
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'u',
        'a',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'blockquote',
        'span',
      ],
      allowedAttributes: { a: ['href'] },
      allowedSchemes: ['http', 'https', 'mailto'],
    });
  }

  private htmlToPlainText(html: string): string {
    return html
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*(p|h[1-6]|li|blockquote|div)\s*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
}
