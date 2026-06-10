import type { Payout } from '../../../generated/prisma/client';
import {
  MailPayload,
  NotificationMessage,
  PushPayload,
} from '../contracts/notification-message.interface';
import { NotificationType } from '../notification-types';

export class PayoutCompletedMessage implements NotificationMessage {
  readonly type: NotificationType = 'payout.completed';

  constructor(private readonly payout: Payout) {}

  data(): Record<string, unknown> {
    return {
      payout_id: this.payout.id,
      organisation_id: this.payout.organisationId,
      amount_minor: Number(this.payout.netMinor),
      currency: this.payout.currency,
    };
  }

  push(): PushPayload {
    return {
      title: 'Payout completed',
      body: 'Your payout has settled in your bank account.',
      data: {},
    };
  }

  mail(): MailPayload {
    return {
      subject: 'Payout completed',
      template: 'payout-completed',
      context: {
        bankName: this.payout.bankName,
        accountNumber: this.payout.accountNumber,
      },
    };
  }
}
