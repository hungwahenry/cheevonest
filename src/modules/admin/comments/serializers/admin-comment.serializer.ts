import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import { AdminComment } from '../services/admin-comments.service';

@Injectable()
export class AdminCommentSerializer {
  constructor(private readonly refs: EntityRefBuilder) {}

  comment(comment: AdminComment): Record<string, unknown> {
    return {
      id: comment.id,
      body: comment.body,
      gif: comment.gif,
      flags_count: comment.flagsCount,
      likes_count: comment.likesCount,
      replies_count: comment.repliesCount,
      parent_id: comment.parentId,
      created_at: comment.createdAt.toISOString(),
      author: this.refs.user(comment.author),
      event: this.refs.event(comment.event),
    };
  }
}
