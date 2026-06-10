import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  BROADCAST_SENT,
  BroadcastSentEvent,
} from '../../broadcasts/events/broadcast-sent.event';
import { BroadcastFinishedMessage } from '../messages/broadcast-finished.message';
import { NotifierService } from '../services/notifier.service';

@Injectable()
export class BroadcastSentListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
  ) {}

  @OnEvent(BROADCAST_SENT, { promisify: true })
  async handle(event: BroadcastSentEvent): Promise<void> {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: event.broadcastId },
    });

    if (!broadcast) {
      return;
    }

    await this.notifier.sendToOrganisation(
      broadcast.organisationId,
      new BroadcastFinishedMessage(broadcast),
    );
  }
}
