import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import { SystemConfigService } from '../../../platform/system-config/system-config.service';
import { EventStartingSoonAttendeeMessage } from '../../messages/event-starting-soon-attendee.message';
import { EventStartingSoonOrganizerMessage } from '../../messages/event-starting-soon-organizer.message';
import { MutesService } from '../mutes.service';
import { NotifierService } from '../notifier.service';

@Injectable()
export class StartingSoonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
    private readonly mutes: MutesService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /** Day-before reminder for organisers + ticket holders / RSVPs, once per event. */
  async run(): Promise<number> {
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

      await this.notifyAttendees(event);

      await this.prisma.event.update({
        where: { id: event.id },
        data: { startingSoonNotifiedAt: new Date() },
      });
    }

    return events.length;
  }

  private async notifyAttendees(event: Event): Promise<void> {
    const [holders, rsvps, muted] = await Promise.all([
      this.prisma.issuedTicket.findMany({
        where: { eventId: event.id },
        select: { holderUserId: true },
        distinct: ['holderUserId'],
      }),
      this.prisma.eventRsvp.findMany({
        where: { eventId: event.id },
        select: { userId: true },
      }),
      this.mutes.mutedUserIds(event.id),
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
