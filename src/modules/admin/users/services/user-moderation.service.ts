import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { User } from '../../../../generated/prisma/client';

@Injectable()
export class UserModerationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Suspends and kills every session in one transaction. */
  async suspend(user: User, reason: string): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      await tx.accessToken.deleteMany({ where: { userId: user.id } });

      return tx.user.update({
        where: { id: user.id },
        data: { suspendedAt: new Date(), suspendedReason: reason },
      });
    });
  }

  async unsuspend(user: User): Promise<User> {
    return this.prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: null, suspendedReason: null },
    });
  }

  async revokeSessions(user: User): Promise<number> {
    const deleted = await this.prisma.accessToken.deleteMany({
      where: { userId: user.id },
    });

    return deleted.count;
  }
}
