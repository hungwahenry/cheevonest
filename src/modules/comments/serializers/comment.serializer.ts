import { Injectable } from '@nestjs/common';
import type { Event, EventComment } from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { DecoratedComment } from '../services/comment-listing.service';

@Injectable()
export class CommentSerializer {
  constructor(
    private readonly users: UserSerializer,
    private readonly storage: StorageService,
  ) {}

  comment(decorated: DecoratedComment): Record<string, unknown> {
    const { comment } = decorated;
    const profile = comment.author.profile;
    const displayName =
      `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();

    return {
      id: comment.id,
      event_id: comment.eventId,
      parent_id: comment.parentId,
      body: comment.body,
      gif: comment.gif,
      mentions: Array.isArray(comment.mentions) ? comment.mentions : [],
      mentioned_users: decorated.mentionedUsers.map((user) => ({
        id: user.id,
        username: user.profile?.username ?? null,
        display_name:
          `${user.profile?.firstName ?? ''} ${user.profile?.lastName ?? ''}`.trim() ||
          null,
      })),
      likes_count: comment.likesCount,
      replies_count: comment.repliesCount,
      is_liked: decorated.isLiked,
      is_mine: decorated.isMine,
      is_going: decorated.isGoing,
      created_at: comment.createdAt.toISOString(),
      author: {
        id: comment.author.id,
        username: profile?.username ?? null,
        display_name: displayName !== '' ? displayName : null,
        avatar_url: profile ? this.users.avatarUrl(profile) : null,
      },
    };
  }

  userComment(
    comment: EventComment & { event: Event },
  ): Record<string, unknown> {
    return {
      id: comment.id,
      body: comment.body,
      gif: comment.gif,
      likes_count: comment.likesCount,
      replies_count: comment.repliesCount,
      created_at: comment.createdAt.toISOString(),
      event: {
        id: comment.event.id,
        slug: comment.event.slug,
        title: comment.event.title,
        flyer_url:
          comment.event.flyerPath !== null
            ? this.storage.url(comment.event.flyerPath)
            : null,
        flyer_type: comment.event.flyerType,
        status: comment.event.status,
      },
    };
  }
}
