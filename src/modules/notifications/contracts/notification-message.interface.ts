import { NotificationChannel, NotificationType } from '../notification-types';

export interface PushPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface MailPayload {
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

export interface NotificationMessage {
  readonly type: NotificationType;
  data(): Record<string, unknown>;
  push(): PushPayload | null;
  mail(): MailPayload | null;
  guaranteedChannels?(): NotificationChannel[];
}
