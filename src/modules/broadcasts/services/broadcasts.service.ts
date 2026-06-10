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
import { BroadcastAudienceEmptyException } from '../exceptions/broadcast-audience-empty.exception';
import { BroadcastsDisabledException } from '../exceptions/broadcasts-disabled.exception';
import { BroadcastRules } from '../rules/broadcast.rules';
import { BroadcastDispatcherService } from './broadcast-dispatcher.service';
import { BroadcastMailerService } from './broadcast-mailer.service';
import { BroadcastRecipientsService } from './broadcast-recipients.service';

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
    private readonly rules: BroadcastRules,
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
    await this.rules.ensureWithinPerEventLimit(event);
    await this.rules.ensureCooldownPassed(event);
    await this.rules.ensureDailyCapNotReached(event.organisationId);

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
