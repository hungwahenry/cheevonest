import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Event } from '../../../generated/prisma/client';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import {
  DailySalesDigestMessage,
  EventStartingSoonAttendeeMessage,
  EventStartingSoonOrganizerMessage,
} from '../messages';
import { MutesService } from './mutes.service';
import { NotifierService } from './notifier.service';

@Injectable()
export class ScheduledNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
    private readonly mutes: MutesService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /** Day-before reminder for organisers + ticket holders / RSVPs, once per event. */
  async notifyStartingSoon(): Promise<number> {
    const hours = await this.systemConfig.int(
      'notifications.event_starting_soon_hours',
      24,
    );
    const target = Date.now() + hours * 3_600_000;
    const windowStart = new Date(target - 30 * 60_000);
    const windowEnd = new Date(target + 30 * 60_000);

    const events = await this.prisma.event.findMany({
      where: {
        status: 'published',
        startingSoonNotifiedAt: null,
        startsAt: { gte: windowStart, lte: windowEnd },
      },
    });

    for (const event of events) {
      await this.notifier.sendToOrganisation(
        event.organisationId,
        new EventStartingSoonOrganizerMessage(event),
      );

      await this.notifyAttendees(event.id, event);

      await this.prisma.event.update({
        where: { id: event.id },
        data: { startingSoonNotifiedAt: new Date() },
      });
    }

    return events.length;
  }

  /** Yesterday's paid revenue per event, mailed to org members once per day. */
  async sendDailySalesDigest(): Promise<number> {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(dayStart.getTime() - 86_400_000);

    const rows = await this.prisma.order.groupBy({
      by: ['eventId'],
      where: {
        status: 'paid',
        paidAt: { gte: yesterdayStart, lt: dayStart },
      },
      _count: { _all: true },
      _sum: { itemsQuantityTotal: true, subtotalMinor: true },
    });

    let sent = 0;

    for (const row of rows) {
      const event = await this.prisma.event.findFirst({
        where: {
          id: row.eventId,
          status: { in: ['published', 'past'] },
          OR: [
            { digestLastSentAt: null },
            { digestLastSentAt: { lt: dayStart } },
          ],
        },
      });

      if (!event) {
        continue;
      }

      await this.notifier.sendToOrganisation(
        event.organisationId,
        new DailySalesDigestMessage(event, {
          revenue_minor: Number(row._sum.subtotalMinor ?? 0n),
          tickets: row._sum.itemsQuantityTotal ?? 0,
          orders: row._count._all,
        }),
      );

      await this.prisma.event.update({
        where: { id: event.id },
        data: { digestLastSentAt: new Date() },
      });

      sent += 1;
    }

    return sent;
  }

  private async notifyAttendees(eventId: string, event: Event): Promise<void> {
    const [holders, rsvps, muted] = await Promise.all([
      this.prisma.issuedTicket.findMany({
        where: { eventId },
        select: { holderUserId: true },
        distinct: ['holderUserId'],
      }),
      this.prisma.eventRsvp.findMany({
        where: { eventId },
        select: { userId: true },
      }),
      this.mutes.mutedUserIds(eventId),
    ]);

    const mutedSet = new Set(muted);
    const attendeeIds = [
      ...new Set([
        ...holders.map((row) => row.holderUserId),
        ...rsvps.map((row) => row.userId),
      ]),
    ].filter((id) => !mutedSet.has(id));

    await this.notifier.send(
      attendeeIds,
      new EventStartingSoonAttendeeMessage(event),
    );
  }
}
