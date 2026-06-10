import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  COMMENT_REPLIED,
  CommentRepliedEvent,
} from '../../comments/events/comment-replied.event';
import { UsersService } from '../../users/services/users.service';
import { CommentReplyMessage } from '../messages';
import { InboxService } from '../services/inbox.service';
import { MutesService } from '../services/mutes.service';
import { NotifierService } from '../services/notifier.service';

@Injectable()
export class CommentRepliedListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
    private readonly inbox: InboxService,
    private readonly mutes: MutesService,
    private readonly users: UsersService,
  ) {}

  @OnEvent(COMMENT_REPLIED, { promisify: true })
  async handle(event: CommentRepliedEvent): Promise<void> {
    const reply = await this.prisma.eventComment.findUnique({
      where: { id: event.replyId },
      include: { event: true, parent: true },
    });

    if (!reply || !reply.parent || reply.parent.userId === reply.userId) {
      return;
    }

    const recipientId = reply.parent.userId;

    if (await this.mutes.hasMuted(recipientId, reply.eventId)) {
      return;
    }

    const blocked = await this.users.mutuallyBlockedUserIds(recipientId);

    if (blocked.includes(reply.userId)) {
      return;
    }

    const alreadyNotified = await this.inbox.hasUnreadOfTypeWithData(
      recipientId,
      'attendee.comment_reply',
      'parent_id',
      reply.parent.id,
    );

    if (alreadyNotified) {
      return;
    }

    await this.notifier.send([recipientId], new CommentReplyMessage(reply));
  }
}
