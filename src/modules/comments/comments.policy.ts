import { ForbiddenException, Injectable } from '@nestjs/common';
import type { EventComment } from '../../generated/prisma/client';

@Injectable()
export class CommentsPolicy {
  ensureAuthor(comment: EventComment, userId: string): void {
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments.');
    }
  }
}
