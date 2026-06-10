import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { DailySalesDigestMessage } from '../../messages/daily-sales-digest.message';
import { NotifierService } from '../notifier.service';

@Injectable()
export class DailySalesDigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
  ) {}

  /** Yesterday's paid revenue per event, mailed to org members once per day. */
  async run(): Promise<number> {
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
}
