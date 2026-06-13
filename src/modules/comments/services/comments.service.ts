import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ulid } from 'ulid';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type {
  Event,
  EventComment,
  User,
} from '../../../generated/prisma/client';
import { FeatureFlagsService } from '../../platform/system-config/feature-flags.service';
import {
  COMMENT_REPLIED,
  CommentRepliedEvent,
} from '../events/comment-replied.event';
import { CommentRules } from '../rules/comment.rules';

export const COMMENT_RESOURCE_INCLUDE = {
  author: { include: { profile: true } },
} satisfies Prisma.EventCommentInclude;

export type CommentForResource = Prisma.EventCommentGetPayload<{
  include: typeof COMMENT_RESOURCE_INCLUDE;
}>;

export interface CreateCommentInput {
  body?: string | null;
  gif?: { id: string; url: string; width: number; height: number } | null;
  parent_id?: string | null;
  mentions?: string[] | null;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureFlagsService,
    private readonly rules: CommentRules,
    private readonly emitter: EventEmitter2,
  ) {}

  async create(
    user: User,
    event: Event,
    input: CreateCommentInput,
  ): Promise<CommentForResource> {
    await this.rules.ensureOpenForComments(event, user.id);

    const body = input.body?.trim() || null;
    let gif = input.gif ?? null;

    if (
      gif !== null &&
      !(await this.features.enabled('comments.giphy_picker', {
        userId: user.id,
      }))
    ) {
      gif = null;
    }

    if (body === null && gif === null) {
      throw new ValidationFailedException({
        body: ['Add a message or a GIF.'],
        gif: ['Add a message or a GIF.'],
      });
    }

    await this.rules.ensureValidParent(event, input.parent_id ?? null);
    await this.rules.ensureMentionsExist(input.mentions ?? null);

    const commentId = ulid();

    await this.prisma.$transaction(async (tx) => {
      await tx.eventComment.create({
        data: {
          id: commentId,
          eventId: event.id,
          userId: user.id,
          parentId: input.parent_id ?? null,
          body,
          gif: gif ?? Prisma.JsonNull,
          mentions: input.mentions ?? Prisma.JsonNull,
        },
      });

      if (input.parent_id) {
        await tx.eventComment.update({
          where: { id: input.parent_id },
          data: { repliesCount: { increment: 1 } },
        });
      }

      await tx.event.update({
        where: { id: event.id },
        data: { commentsCount: { increment: 1 } },
      });
    });

    if (input.parent_id) {
      await this.emitter.emitAsync(
        COMMENT_REPLIED,
        new CommentRepliedEvent(commentId),
      );
    }

    return this.prisma.eventComment.findUniqueOrThrow({
      where: { id: commentId },
      include: COMMENT_RESOURCE_INCLUDE,
    });
  }

  async delete(comment: EventComment): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.eventComment.delete({ where: { id: comment.id } });

      if (comment.parentId !== null) {
        await tx.eventComment.updateMany({
          where: { id: comment.parentId },
          data: { repliesCount: { decrement: 1 } },
        });
      }

      await tx.event.update({
        where: { id: comment.eventId },
        data: { commentsCount: { decrement: 1 + comment.repliesCount } },
      });
    });
  }

  async like(user: User, comment: EventComment): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.eventCommentLike.createMany({
        data: [{ commentId: comment.id, userId: user.id }],
        skipDuplicates: true,
      });

      if (result.count > 0) {
        await tx.eventComment.update({
          where: { id: comment.id },
          data: { likesCount: { increment: 1 } },
        });
      }
    });
  }

  async unlike(user: User, comment: EventComment): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.eventCommentLike.deleteMany({
        where: { commentId: comment.id, userId: user.id },
      });

      if (deleted.count > 0) {
        await tx.eventComment.update({
          where: { id: comment.id },
          data: { likesCount: { decrement: 1 } },
        });
      }
    });
  }

  async flag(
    organizer: User,
    comment: EventComment,
    reason: string | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.eventCommentFlag.createMany({
        data: [
          { commentId: comment.id, flaggedByUserId: organizer.id, reason },
        ],
        skipDuplicates: true,
      });

      if (result.count > 0) {
        await tx.eventComment.update({
          where: { id: comment.id },
          data: { flagsCount: { increment: 1 } },
        });
      }
    });
  }

  async unflag(organizer: User, comment: EventComment): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.eventCommentFlag.deleteMany({
        where: { commentId: comment.id, flaggedByUserId: organizer.id },
      });

      if (deleted.count > 0) {
        await tx.eventComment.update({
          where: { id: comment.id },
          data: { flagsCount: { decrement: 1 } },
        });
      }
    });
  }

  /** A reply target / reply-list parent: top-level and, unless moderating, unflagged. */
  async findVisibleTopLevel(
    eventId: string,
    commentId: string,
    options: { includeFlagged?: boolean } = {},
  ): Promise<EventComment> {
    const comment = await this.findScoped(eventId, commentId);

    if (comment.parentId !== null) {
      throw new NotFoundException();
    }

    if (!options.includeFlagged && comment.flagsCount !== 0) {
      throw new NotFoundException();
    }

    return comment;
  }

  /** Admin "dismiss flags": clears every flag and zeroes the counter. Returns the count cleared. */
  async dismissAllFlags(comment: EventComment): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const cleared = await tx.eventCommentFlag.deleteMany({
        where: { commentId: comment.id },
      });

      if (cleared.count > 0) {
        await tx.eventComment.update({
          where: { id: comment.id },
          data: { flagsCount: 0 },
        });
      }

      return cleared.count;
    });
  }

  async findScoped(eventId: string, commentId: string): Promise<EventComment> {
    const comment = await this.prisma.eventComment.findFirst({
      where: { id: commentId, eventId },
    });

    if (!comment) {
      throw new NotFoundException();
    }

    return comment;
  }

  async freshLikesCount(commentId: string): Promise<number> {
    const comment = await this.prisma.eventComment.findUniqueOrThrow({
      where: { id: commentId },
      select: { likesCount: true },
    });

    return comment.likesCount;
  }

  async freshFlagsCount(commentId: string): Promise<number> {
    const comment = await this.prisma.eventComment.findUniqueOrThrow({
      where: { id: commentId },
      select: { flagsCount: true },
    });

    return comment.flagsCount;
  }
}
