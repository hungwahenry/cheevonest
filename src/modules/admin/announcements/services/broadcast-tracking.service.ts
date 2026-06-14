import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class BroadcastTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Counts a click and returns the original destination, or null if unknown. */
  async resolveClick(linkId: string): Promise<string | null> {
    const link = await this.prisma.adminBroadcastLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      return null;
    }

    await this.prisma.$transaction([
      this.prisma.adminBroadcastLink.update({
        where: { id: link.id },
        data: { clickCount: { increment: 1 } },
      }),
      this.prisma.adminBroadcast.update({
        where: { id: link.broadcastId },
        data: { clickCount: { increment: 1 } },
      }),
    ]);

    return link.url;
  }

  /** Globally opts a user out of marketing; idempotent. */
  async unsubscribeMarketing(userId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException();
    }

    await this.prisma.profile.update({
      where: { userId },
      data: { marketingOptIn: false },
    });
  }
}
