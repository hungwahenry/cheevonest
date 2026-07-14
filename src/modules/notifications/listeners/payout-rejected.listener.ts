import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  PAYOUT_REJECTED,
  PayoutRejectedEvent,
} from '../../payouts/events/payout-rejected.event';
import { PayoutRejectedMessage } from '../messages';
import { NotifierService } from '../services/notifier.service';

@Injectable()
export class PayoutRejectedListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
  ) {}

  @OnEvent(PAYOUT_REJECTED, { promisify: true })
  async handle(event: PayoutRejectedEvent): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: event.payoutId },
    });

    if (!payout) {
      return;
    }

    await this.notifier.sendToOrganisation(
      payout.organisationId,
      new PayoutRejectedMessage(payout),
    );
  }
}
