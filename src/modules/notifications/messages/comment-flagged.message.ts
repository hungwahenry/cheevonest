import type { EventComment } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';
import { limit } from './support';

export class CommentFlaggedMessage implements NotificationMessage {
  readonly type: NotificationType = 'comment.flagged';

  constructor(private readonly comment: EventComment) {}

  data(): Record<string, unknown> {
    return {
      comment_id: this.comment.id,
      event_id: this.comment.eventId,
    };
  }

  push(): PushPayload {
    return {
      title: 'Comment reported',
      body: 'A comment on your event was reported by an attendee.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'A comment on your event was reported',
      template: 'comment-flagged',
      context: { preview: limit(this.comment.body, 200) },
    };
  }
}
