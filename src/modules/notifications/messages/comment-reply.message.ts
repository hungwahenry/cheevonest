import type { Event, EventComment } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';
import { limit } from './support';

export class CommentReplyMessage implements NotificationMessage {
  readonly type: NotificationType = 'attendee.comment_reply';

  constructor(private readonly reply: EventComment & { event: Event }) {}

  data(): Record<string, unknown> {
    return {
      reply_id: this.reply.id,
      parent_id: this.reply.parentId,
      event_id: this.reply.eventId,
      event_slug: this.reply.event.slug,
      preview: limit(this.reply.body, 120),
    };
  }

  push(): PushPayload {
    return {
      title: 'New reply on your comment',
      body: limit(this.reply.body, 100) || 'Tap to view the reply.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'Someone replied to your comment',
      template: 'comment-reply',
      context: {
        eventTitle: this.reply.event.title,
        eventSlug: this.reply.event.slug,
        preview: limit(this.reply.body, 200),
      },
    };
  }
}
