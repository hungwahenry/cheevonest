import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { PrismaService } from '../../../database/prisma.service';
import type { Event } from '../../../generated/prisma/client';
import { FeatureFlagsService } from '../../platform/system-config/feature-flags.service';
import { EventNotOpenForCommentsException } from '../exceptions/event-not-open-for-comments.exception';

@Injectable()
export class CommentRules {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureFlagsService,
  ) {}

  async ensureOpenForComments(event: Event, userId: string): Promise<void> {
    if (!(await this.features.enabled('comments.enabled', { userId }))) {
      throw new EventNotOpenForCommentsException();
    }

    if (event.status !== 'published' || event.commentsLockedAt !== null) {
      throw new EventNotOpenForCommentsException();
    }
  }

  async ensureValidParent(
    event: Event,
    parentId: string | null,
  ): Promise<void> {
    if (parentId === null) {
      return;
    }

    const parent = await this.prisma.eventComment.findFirst({
      where: { id: parentId, eventId: event.id, parentId: null },
      select: { id: true },
    });

    if (!parent) {
      throw new ValidationFailedException({
        parent_id: ['You can only reply to a top-level comment on this event.'],
      });
    }
  }

  async ensureMentionsExist(mentions: string[] | null): Promise<void> {
    if (!mentions || mentions.length === 0) {
      return;
    }

    const unique = [...new Set(mentions)];
    const found = await this.prisma.user.count({
      where: { id: { in: unique } },
    });

    if (found !== unique.length) {
      throw new ValidationFailedException({
        mentions: ['The selected mentions are invalid.'],
      });
    }
  }
}
