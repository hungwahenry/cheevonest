import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type {
  AdminBroadcast,
  AdminBroadcastKind,
} from '../../../../generated/prisma/client';
import type { NotificationChannel } from '../../../notifications/notification-types';
import { BroadcastNotEditableException } from '../exceptions/broadcast-not-editable.exception';
import { BroadcastNotSendableException } from '../exceptions/broadcast-not-sendable.exception';
import { EmptyBroadcastAudienceException } from '../exceptions/empty-broadcast-audience.exception';
import {
  AudienceSegmentService,
  SegmentDefinition,
} from './audience-segment.service';
import { BroadcastSenderService } from './broadcast-sender.service';

export interface BroadcastInput {
  kind: AdminBroadcastKind;
  title: string;
  body: string;
  channels: NotificationChannel[];
  audience: SegmentDefinition;
}

export type BroadcastWithLinks = Prisma.AdminBroadcastGetPayload<{
  include: { links: true };
}>;

@Injectable()
export class AdminBroadcastService {
  private readonly logger = new Logger(AdminBroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly segments: AudienceSegmentService,
    private readonly sender: BroadcastSenderService,
  ) {}

  async page(params: {
    page: number;
    perPage: number;
    kind?: AdminBroadcastKind;
    status?: AdminBroadcast['status'];
  }): Promise<{ items: AdminBroadcast[]; total: number }> {
    const where: Prisma.AdminBroadcastWhereInput = {
      ...(params.kind ? { kind: params.kind } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminBroadcast.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      this.prisma.adminBroadcast.count({ where }),
    ]);

    return { items, total };
  }

  async findOrFail(id: string): Promise<AdminBroadcast> {
    const broadcast = await this.prisma.adminBroadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundException();
    }

    return broadcast;
  }

  async detail(id: string): Promise<BroadcastWithLinks> {
    const broadcast = await this.prisma.adminBroadcast.findUnique({
      where: { id },
      include: { links: { orderBy: { clickCount: 'desc' } } },
    });

    if (!broadcast) {
      throw new NotFoundException();
    }

    return broadcast;
  }

  async create(
    adminUserId: string,
    input: BroadcastInput,
  ): Promise<AdminBroadcast> {
    return this.prisma.adminBroadcast.create({
      data: {
        id: ulid(),
        kind: input.kind,
        status: 'draft',
        title: input.title,
        body: input.body,
        channels: input.channels,
        audience: input.audience as unknown as Prisma.InputJsonValue,
        createdByUserId: adminUserId,
      },
    });
  }

  async update(id: string, input: BroadcastInput): Promise<AdminBroadcast> {
    const broadcast = await this.findOrFail(id);
    this.assertDraft(broadcast);

    return this.prisma.adminBroadcast.update({
      where: { id },
      data: {
        kind: input.kind,
        title: input.title,
        body: input.body,
        channels: input.channels,
        audience: input.audience as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const broadcast = await this.findOrFail(id);
    this.assertDraft(broadcast);

    await this.prisma.adminBroadcast.delete({ where: { id } });
  }

  async preview(
    audience: SegmentDefinition,
    kind: AdminBroadcastKind,
  ): Promise<number> {
    return this.segments.count(audience, {
      requireMarketingConsent: kind === 'marketing',
    });
  }

  async schedule(id: string, scheduledAt: Date): Promise<AdminBroadcast> {
    const broadcast = await this.findOrFail(id);
    this.assertDraft(broadcast);

    return this.prisma.adminBroadcast.update({
      where: { id },
      data: { status: 'scheduled', scheduledAt },
    });
  }

  async cancel(id: string): Promise<AdminBroadcast> {
    const broadcast = await this.findOrFail(id);

    if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
      throw new BroadcastNotSendableException(broadcast.status);
    }

    return this.prisma.adminBroadcast.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  /** Sends immediately; guards status + non-empty audience, records stats, flips to sent/failed. */
  async send(id: string): Promise<AdminBroadcast> {
    const broadcast = await this.findOrFail(id);

    if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
      throw new BroadcastNotSendableException(broadcast.status);
    }

    const recipients = await this.preview(
      broadcast.audience as SegmentDefinition,
      broadcast.kind,
    );

    if (recipients === 0) {
      throw new EmptyBroadcastAudienceException();
    }

    const sending = await this.prisma.adminBroadcast.update({
      where: { id },
      data: { status: 'sending', startedAt: new Date() },
    });

    try {
      const stats = await this.sender.deliver(sending);

      return this.prisma.adminBroadcast.update({
        where: { id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          recipientsCount: stats.recipients,
          emailCount: stats.email,
          pushCount: stats.push,
          inappCount: stats.inapp,
          failedCount: stats.failed,
        },
      });
    } catch (error) {
      this.logger.error(`Broadcast ${id} failed: ${String(error)}`);

      return this.prisma.adminBroadcast.update({
        where: { id },
        data: {
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'unknown',
        },
      });
    }
  }

  /** Cron entry point: dispatch every scheduled broadcast whose time has come. */
  async runDue(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.adminBroadcast.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now } },
      select: { id: true },
    });

    let dispatched = 0;

    for (const { id } of due) {
      try {
        await this.send(id);
        dispatched += 1;
      } catch (error) {
        this.logger.error(`Scheduled broadcast ${id} failed: ${String(error)}`);
      }
    }

    return dispatched;
  }

  private assertDraft(broadcast: AdminBroadcast): void {
    if (broadcast.status !== 'draft') {
      throw new BroadcastNotEditableException(broadcast.status);
    }
  }
}
