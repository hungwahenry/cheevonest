import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import {
  BROADCAST_SENT,
  BroadcastSentEvent,
} from '../events/broadcast-sent.event';
import { BroadcastMailerService } from './broadcast-mailer.service';
import { BroadcastRecipientsService } from './broadcast-recipients.service';

@Injectable()
export class BroadcastDispatcherService {
  private readonly logger = new Logger(BroadcastDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipients: BroadcastRecipientsService,
    private readonly mailer: BroadcastMailerService,
    private readonly systemConfig: SystemConfigService,
    private readonly emitter: EventEmitter2,
  ) {}

  /** Fire-and-forget: the request returns immediately, delivery runs in-process. */
  kickOff(broadcastId: string): void {
    void this.dispatch(broadcastId).catch(async (error) => {
      this.logger.error(
        `broadcast ${broadcastId} dispatch crashed: ${String(error)}`,
      );

      await this.prisma.broadcast.updateMany({
        where: { id: broadcastId, status: { in: ['queued', 'sending'] } },
        data: { status: 'failed', failureReason: String(error) },
      });
    });
  }

  async dispatch(broadcastId: string): Promise<void> {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: { event: true, organisation: true },
    });

    if (!broadcast || broadcast.status !== 'queued') {
      return;
    }

    const recipients = await this.recipients.resolve(
      broadcast.event,
      broadcast.audience,
    );

    if (recipients.length === 0) {
      await this.prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          status: 'failed',
          failureReason: 'No recipients at send time.',
        },
      });

      return;
    }

    await this.prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: 'sending', recipientsCount: recipients.length },
    });

    const chunkSize = await this.systemConfig.int('broadcasts.chunk_size', 100);

    for (let i = 0; i < recipients.length; i += chunkSize) {
      const current = await this.prisma.broadcast.findUniqueOrThrow({
        where: { id: broadcast.id },
        select: { status: true },
      });

      if (current.status === 'cancelled') {
        return;
      }

      const chunk = recipients.slice(i, i + chunkSize);
      let sent = 0;
      let failed = 0;

      for (const recipient of chunk) {
        try {
          await this.mailer.send({
            to: recipient.email,
            subject: broadcast.subject,
            bodyHtml: broadcast.bodyHtml,
            bodyText: broadcast.bodyText,
            organisation: broadcast.organisation,
            event: broadcast.event,
          });
          sent += 1;
        } catch (error) {
          failed += 1;
          this.logger.error(
            `broadcast ${broadcast.id} recipient ${recipient.email} failed: ${String(error)}`,
          );
        }
      }

      await this.prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          sentCount: { increment: sent },
          failedCount: { increment: failed },
        },
      });
    }

    await this.markSent(broadcast.id);
  }

  /** Sweep for broadcasts stuck queued/sending (crashed mid-dispatch) and finish them. */
  async retryStuck(staleMinutes = 10): Promise<number> {
    const staleBefore = new Date(Date.now() - staleMinutes * 60_000);

    const stuck = await this.prisma.broadcast.findMany({
      where: {
        status: { in: ['queued', 'sending'] },
        updatedAt: { lt: staleBefore },
      },
      select: { id: true, status: true },
    });

    for (const broadcast of stuck) {
      // Re-queue mid-send broadcasts so dispatch restarts from the top; a few
      // duplicate mails beat silently dropping the rest of the audience.
      if (broadcast.status === 'sending') {
        await this.prisma.broadcast.update({
          where: { id: broadcast.id },
          data: { status: 'queued' },
        });
      }

      this.kickOff(broadcast.id);
    }

    return stuck.length;
  }

  private async markSent(broadcastId: string): Promise<void> {
    const updated = await this.prisma.broadcast.updateMany({
      where: { id: broadcastId, status: 'sending' },
      data: { status: 'sent', sentAt: new Date() },
    });

    if (updated.count > 0) {
      await this.emitter.emitAsync(
        BROADCAST_SENT,
        new BroadcastSentEvent(broadcastId),
      );
    }
  }
}
