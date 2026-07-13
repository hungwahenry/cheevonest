import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationChannel, NotificationType } from '../notification-types';

export interface AlertRow {
  label: string;
  value: string;
}

export class AdminAlertMessage implements NotificationMessage {
  constructor(
    readonly type: NotificationType,
    private readonly heading: string,
    private readonly summary: string,
    private readonly rows: AlertRow[] = [],
    private readonly meta: Record<string, unknown> = {},
  ) {}

  data(): Record<string, unknown> {
    return { heading: this.heading, summary: this.summary, ...this.meta };
  }

  push(): PushPayload {
    return { title: this.heading, body: this.summary, data: {} };
  }

  mail(): MailPayload {
    return {
      subject: this.heading,
      template: 'admin-alert',
      context: {
        heading: this.heading,
        summary: this.summary,
        rows: this.rows,
      },
    };
  }

  guaranteedChannels(): NotificationChannel[] {
    return ['inapp', 'email'];
  }
}
