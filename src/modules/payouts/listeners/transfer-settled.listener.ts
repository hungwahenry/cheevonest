import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TRANSFER_SETTLED,
  TransferSettledEvent,
} from '../../payments/events/transfer-settled.event';
import { PayoutProcessingService } from '../services/payout-processing.service';

@Injectable()
export class TransferSettledListener {
  constructor(private readonly processing: PayoutProcessingService) {}

  @OnEvent(TRANSFER_SETTLED, { promisify: true })
  async handle(event: TransferSettledEvent): Promise<void> {
    await this.processing.finalize(event.transfer);
  }
}
