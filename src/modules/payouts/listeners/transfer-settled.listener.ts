import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TRANSFER_SETTLED,
  TransferSettledEvent,
} from '../../payments/events/transfer-settled.event';
import { PayoutsService } from '../services/payouts.service';

@Injectable()
export class TransferSettledListener {
  constructor(private readonly payouts: PayoutsService) {}

  @OnEvent(TRANSFER_SETTLED, { promisify: true })
  async handle(event: TransferSettledEvent): Promise<void> {
    await this.payouts.finalize(event.transfer);
  }
}
