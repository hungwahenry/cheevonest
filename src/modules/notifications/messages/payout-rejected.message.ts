import type { Payout } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class PayoutRejectedMessage implements NotificationMessage {
  readonly type: NotificationType = 'payout.rejected';

  constructor(private readonly payout: Payout) {}

  data(): Record<string, unknown> {
    return {
      payout_id: this.payout.id,
      organisation_id: this.payout.organisationId,
      amount_minor: Number(this.payout.amountMinor),
      currency: this.payout.currency,
      review_notes: this.payout.reviewNotes,
    };
  }

  push(): PushPayload {
    return {
      title: 'Payout declined',
      body: 'A payout you requested was declined. Tap to review.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'Payout declined',
      template: 'payout-rejected',
      context: { reason: this.payout.reviewNotes ?? null },
    };
  }
}
