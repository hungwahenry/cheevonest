import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EventsCronsService {
  private readonly logger = new Logger(EventsCronsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *')
  async markPastEvents(): Promise<number> {
    const updated = await this.prisma.event.updateMany({
      where: { status: 'published', endsAt: { lt: new Date() } },
      data: { status: 'past' },
    });

    if (updated.count > 0) {
      this.logger.log(`Marked ${updated.count} event(s) as past.`);
    }

    return updated.count;
  }
}
