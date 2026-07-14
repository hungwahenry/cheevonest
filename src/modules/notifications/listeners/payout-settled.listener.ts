import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  PAYOUT_SETTLED,
  PayoutSettledEvent,
} from '../../payouts/events/payout-settled.event';
import { PayoutCompletedMessage, PayoutFailedMessage } from '../messages';
import { NotifierService } from '../services/notifier.service';

@Injectable()
export class PayoutSettledListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
  ) {}

  @OnEvent(PAYOUT_SETTLED, { promisify: true })
  async handle(event: PayoutSettledEvent): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: event.payoutId },
    });

    if (!payout) {
      return;
    }

    const message =
      payout.status === 'paid'
        ? new PayoutCompletedMessage(payout)
        : payout.status === 'failed'
          ? new PayoutFailedMessage(payout)
          : null;

    if (message) {
      await this.notifier.sendToOrganisation(payout.organisationId, message);
    }
  }
}
