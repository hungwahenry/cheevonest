import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { EventComment } from '../../../../generated/prisma/client';

export const ADMIN_COMMENT_INCLUDE = {
  author: { include: { profile: true } },
  event: true,
} satisfies Prisma.EventCommentInclude;

export type AdminComment = Prisma.EventCommentGetPayload<{
  include: typeof ADMIN_COMMENT_INCLUDE;
}>;

@Injectable()
export class AdminCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    flaggedOnly?: boolean;
    eventId?: string;
  }): Promise<{ items: AdminComment[]; total: number }> {
    const where: Prisma.EventCommentWhereInput = {
      ...(options.flaggedOnly ? { flagsCount: { gt: 0 } } : {}),
      ...(options.eventId ? { eventId: options.eventId } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.eventComment.count({ where }),
      this.prisma.eventComment.findMany({
        where,
        include: ADMIN_COMMENT_INCLUDE,
        orderBy: [{ flagsCount: 'desc' }, { createdAt: 'desc' }],
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async findOrFail(commentId: string): Promise<EventComment> {
    const comment = await this.prisma.eventComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException();
    }

    return comment;
  }
}
