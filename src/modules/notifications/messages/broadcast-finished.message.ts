import type { Broadcast } from '../../../generated/prisma/client';
import {
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class BroadcastFinishedMessage implements NotificationMessage {
  readonly type: NotificationType = 'broadcast.finished';

  constructor(private readonly broadcast: Broadcast) {}

  data(): Record<string, unknown> {
    return {
      broadcast_id: this.broadcast.id,
      event_id: this.broadcast.eventId,
      subject: this.broadcast.subject,
      sent_count: this.broadcast.sentCount,
      failed_count: this.broadcast.failedCount,
    };
  }

  push(): PushPayload {
    return {
      title: 'Broadcast finished',
      body: `"${this.broadcast.subject}" reached ${this.broadcast.sentCount} recipient(s).`,
      data: {},
    };
  }

  mail(): null {
    return null;
  }
}
