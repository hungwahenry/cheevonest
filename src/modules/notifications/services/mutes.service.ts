import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MutesService {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(userId: string, eventId: string): Promise<boolean> {
    const deleted = await this.prisma.eventNotificationMute.deleteMany({
      where: { userId, eventId },
    });

    if (deleted.count > 0) {
      return false;
    }

    await this.prisma.eventNotificationMute.create({
      data: { userId, eventId },
    });

    return true;
  }

  async hasMuted(userId: string, eventId: string): Promise<boolean> {
    const row = await this.prisma.eventNotificationMute.findUnique({
      where: { userId_eventId: { userId, eventId } },
      select: { userId: true },
    });

    return row !== null;
  }

  async mutedUserIds(eventId: string): Promise<string[]> {
    const rows = await this.prisma.eventNotificationMute.findMany({
      where: { eventId },
      select: { userId: true },
    });

    return rows.map((row) => row.userId);
  }
}
