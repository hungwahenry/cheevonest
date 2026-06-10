import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { BlockTargetNotFoundException } from '../exceptions/block-target-not-found.exception';
import type { BlockableType } from '../blocks.service';

@Injectable()
export class BlockRules {
  constructor(private readonly prisma: PrismaService) {}

  async ensureTargetExists(
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
