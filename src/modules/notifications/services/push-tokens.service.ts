import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import type { NotificationAudience } from '../../../generated/prisma/client';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tokens are device-scoped: re-registering moves the token to its current user. */
  async register(
    userId: string,
    token: string,
    audience: NotificationAudience,
    deviceId: string | null,
  ): Promise<void> {
    await this.prisma.expoPushToken.upsert({
      where: { token },
      update: { userId, audience, deviceId, lastActiveAt: new Date() },
      create: {
        id: ulid(),
        userId,
        token,
        audience,
        deviceId,
        lastActiveAt: new Date(),
      },
    });
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.expoPushToken.deleteMany({
      where: { userId, token },
    });
  }
}
