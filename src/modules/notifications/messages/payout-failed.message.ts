import type { Payout } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class PayoutFailedMessage implements NotificationMessage {
  readonly type: NotificationType = 'payout.failed';

  constructor(private readonly payout: Payout) {}

  data(): Record<string, unknown> {
    return {
      payout_id: this.payout.id,
      organisation_id: this.payout.organisationId,
      amount_minor: Number(this.payout.netMinor),
      currency: this.payout.currency,
      failed_reason: this.payout.failedReason,
    };
  }

  push(): PushPayload {
    return {
      title: 'Payout failed',
      body: 'A payout could not be completed. Tap to review.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'Payout failed',
      template: 'payout-failed',
      context: { reason: this.payout.failedReason ?? 'Unknown reason' },
    };
  }
}
