import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { User } from '../../../generated/prisma/client';
import { SubscriptionsService } from '../organisations/services/subscriptions.service';
import { BlockTargetNotFoundException } from './exceptions/block-target-not-found.exception';
import { CannotBlockYourselfException } from './exceptions/cannot-block-yourself.exception';
import { InvalidBlockTargetException } from './exceptions/invalid-block-target.exception';

export const BLOCKABLE_TYPES = ['user', 'organisation'] as const;
export type BlockableType = (typeof BLOCKABLE_TYPES)[number];

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async block(
    blocker: User,
    targetType: string,
    targetId: string,
  ): Promise<void> {
    const type = this.resolveType(targetType);

    await this.ensureTargetExists(type, targetId);

    if (type === 'user' && targetId === blocker.id) {
      throw new CannotBlockYourselfException();
    }

    await this.prisma.block.upsert({
      where: {
        blockerUserId_blockableType_blockableId: {
          blockerUserId: blocker.id,
          blockableType: type,
          blockableId: targetId,
        },
      },
      update: {},
      create: {
        blockerUserId: blocker.id,
        blockableType: type,
        blockableId: targetId,
      },
    });

    if (type === 'organisation') {
      await this.subscriptions.unsubscribe(blocker.id, targetId);
    }
  }

  async unblock(
    blocker: User,
    targetType: string,
    targetId: string,
  ): Promise<void> {
    const type = this.resolveType(targetType);

    await this.prisma.block.deleteMany({
      where: {
        blockerUserId: blocker.id,
        blockableType: type,
        blockableId: targetId,
      },
    });
  }

  private resolveType(targetType: string): BlockableType {
    if (!BLOCKABLE_TYPES.includes(targetType as BlockableType)) {
      throw new InvalidBlockTargetException();
    }

    return targetType as BlockableType;
  }

  private async ensureTargetExists(
    type: BlockableType,
    targetId: string,
  ): Promise<void> {
    const exists =
      type === 'user'
        ? await this.prisma.user.findUnique({
            where: { id: targetId },
            select: { id: true },
          })
        : await this.prisma.organisation.findUnique({
            where: { id: targetId },
            select: { id: true },
          });

    if (!exists) {
      throw new BlockTargetNotFoundException();
    }
  }
}
