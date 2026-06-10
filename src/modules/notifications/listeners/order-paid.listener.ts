import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  ORDER_PAID,
  OrderPaidEvent,
} from '../../orders/events/order-paid.event';
import { FirstSaleMessage, OrderPaidMessage } from '../messages';
import { NotifierService } from '../services/notifier.service';

@Injectable()
export class OrderPaidListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
  ) {}

  @OnEvent(ORDER_PAID, { promisify: true })
  async handle(event: OrderPaidEvent): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      include: { event: true },
    });

    if (!order) {
      return;
    }

    await this.notifier.send([order.userId], new OrderPaidMessage(order));

    if (event.isFirstSale) {
      await this.notifier.sendToOrganisation(
        order.event.organisationId,
        new FirstSaleMessage(order.event, order),
      );
    }
  }
}
