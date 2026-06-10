import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Organisation, User } from '../../../../generated/prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent — re-subscribing never double-counts the subscriber. */
  async subscribe(user: User, organisation: Organisation): Promise<void> {
    const existing = await this.prisma.subscription.findUnique({
      where: {
        userId_organisationId: {
          userId: user.id,
          organisationId: organisation.id,
        },
      },
    });

    if (existing) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.subscription.create({
        data: { userId: user.id, organisationId: organisation.id },
      }),
      this.prisma.organisation.update({
        where: { id: organisation.id },
        data: { subscribersCount: { increment: 1 } },
      }),
    ]);
  }

  async unsubscribe(userId: string, organisationId: string): Promise<void> {
    const deleted = await this.prisma.subscription.deleteMany({
      where: { userId, organisationId },
    });

    if (deleted.count > 0) {
      await this.prisma.organisation.update({
        where: { id: organisationId },
        data: { subscribersCount: { decrement: 1 } },
      });
    }
  }
}
