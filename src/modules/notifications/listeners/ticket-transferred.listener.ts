import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  TICKET_TRANSFERRED,
  TicketTransferredEvent,
} from '../../transfers/events/ticket-transferred.event';
import { TicketTransferReceivedMessage } from '../messages/ticket-transfer-received.message';
import { NotifierService } from '../services/notifier.service';

@Injectable()
export class TicketTransferredListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
  ) {}

  @OnEvent(TICKET_TRANSFERRED, { promisify: true })
  async handle(event: TicketTransferredEvent): Promise<void> {
    const ticket = await this.prisma.issuedTicket.findUnique({
      where: { id: event.issuedTicketId },
      include: { event: true },
    });

    if (!ticket) {
      return;
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: event.fromUserId },
      include: { profile: true },
    });

    const name =
      `${sender?.profile?.firstName ?? ''} ${sender?.profile?.lastName ?? ''}`.trim();
    const senderName = sender?.profile?.username || name || 'Someone';

    await this.notifier.send(
      [event.toUserId],
      new TicketTransferReceivedMessage(ticket, senderName),
    );
  }
}
