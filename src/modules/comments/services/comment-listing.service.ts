import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type {
  Event,
  EventComment,
  User,
} from '../../../generated/prisma/client';
import { UsersService } from '../../users/services/users.service';
import {
  COMMENT_RESOURCE_INCLUDE,
  CommentForResource,
} from './comments.service';

export interface DecoratedComment {
  comment: CommentForResource;
  isLiked: boolean;
  isMine: boolean;
  isGoing: boolean;
  mentionedUsers: Array<{
    id: string;
    profile: {
      username: string | null;
      firstName: string | null;
      lastName: string | null;
    } | null;
  }>;
}

export interface TopLevelOptions {
  page: number;
  perPage: number;
  search?: string | null;
  flaggedOnly?: boolean;
  includeFlagged?: boolean;
}

export interface CommentPage {
  items: DecoratedComment[];
  total: number;
}

@Injectable()
export class CommentListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async topLevel(
    event: Event,
    viewer: User,
    options: TopLevelOptions,
  ): Promise<CommentPage> {
    const hidden = await this.users.mutuallyBlockedUserIds(viewer.id);

    const where: Prisma.EventCommentWhereInput = {
      eventId: event.id,
      parentId: null,
      ...(options.flaggedOnly
        ? { flagsCount: { gt: 0 } }
        : options.includeFlagged
          ? {}
          : { flagsCount: 0 }),
      ...(hidden.length > 0 ? { userId: { notIn: hidden } } : {}),
      ...(options.search
        ? { body: { contains: options.search, mode: 'insensitive' } }
        : {}),
    };

    return this.page(where, event, viewer, options.page, options.perPage);
  }

  async replies(
    event: Event,
    parent: EventComment,
    viewer: User,
    page: number,
    perPage: number,
  ): Promise<CommentPage> {
    const hidden = await this.users.mutuallyBlockedUserIds(viewer.id);

    const where: Prisma.EventCommentWhereInput = {
      parentId: parent.id,
      flagsCount: 0,
      ...(hidden.length > 0 ? { userId: { notIn: hidden } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.eventComment.count({ where }),
      this.prisma.eventComment.findMany({
        where,
        include: COMMENT_RESOURCE_INCLUDE,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items: await this.decorate(rows, event, viewer), total };
  }

  /** Public profile comments: unflagged, on visible events, newest first. */
  async userCommentsPage(
    userId: string,
    page: number,
    perPage: number,
  ): Promise<{
    items: Array<Prisma.EventCommentGetPayload<{ include: { event: true } }>>;
    total: number;
  }> {
    const where: Prisma.EventCommentWhereInput = {
      userId,
      flagsCount: 0,
      event: { status: { in: ['published', 'past'] } },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.eventComment.count({ where }),
      this.prisma.eventComment.findMany({
        where,
        include: { event: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total };
  }

  async decorateOne(
    comment: CommentForResource,
    event: Event,
    viewer: User,
  ): Promise<DecoratedComment> {
    const [decorated] = await this.decorate([comment], event, viewer);

    return decorated;
  }

  private async page(
    where: Prisma.EventCommentWhereInput,
    event: Event,
    viewer: User,
    page: number,
    perPage: number,
  ): Promise<CommentPage> {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.eventComment.count({ where }),
      this.prisma.eventComment.findMany({
        where,
        include: COMMENT_RESOURCE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items: await this.decorate(rows, event, viewer), total };
  }

  private async decorate(
    comments: CommentForResource[],
    event: Event,
    viewer: User,
  ): Promise<DecoratedComment[]> {
    if (comments.length === 0) {
      return [];
    }

    const commentIds = comments.map((comment) => comment.id);
    const authorIds = [...new Set(comments.map((comment) => comment.userId))];
    const mentionIds = [
      ...new Set(
        comments.flatMap((comment) =>
          Array.isArray(comment.mentions) ? (comment.mentions as string[]) : [],
        ),
      ),
    ];

    const [likes, rsvps, mentionedUsers] = await Promise.all([
      this.prisma.eventCommentLike.findMany({
        where: { userId: viewer.id, commentId: { in: commentIds } },
        select: { commentId: true },
      }),
      this.prisma.eventRsvp.findMany({
        where: { eventId: event.id, userId: { in: authorIds } },
        select: { userId: true },
      }),
      mentionIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: mentionIds } },
            include: { profile: true },
          })
        : Promise.resolve([]),
    ]);

    const likedIds = new Set(likes.map((like) => like.commentId));
    const goingIds = new Set(rsvps.map((rsvp) => rsvp.userId));
    const mentionedById = new Map(
      mentionedUsers.map((user) => [user.id, user]),
    );

    return comments.map((comment) => ({
      comment,
      isLiked: likedIds.has(comment.id),
      isMine: comment.userId === viewer.id,
      isGoing: goingIds.has(comment.userId),
      mentionedUsers: (Array.isArray(comment.mentions)
        ? (comment.mentions as string[])
        : []
      ).flatMap((id) => {
        const user = mentionedById.get(id);

        return user ? [user] : [];
      }),
    }));
  }
}
