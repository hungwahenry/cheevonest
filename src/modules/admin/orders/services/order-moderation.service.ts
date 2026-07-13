import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Order } from '../../../../generated/prisma/client';
import { LedgerService } from '../../../ledger/ledger.service';
import { PaymentsService } from '../../../payments/services/payments.service';
import { OrdersService } from '../../../orders/services/orders.service';
import { IssuedTicketsService } from '../../../tickets/services/issued-tickets.service';
import { OrderNotMarkPayableException } from '../exceptions/order-not-mark-payable.exception';
import { OrderNotRefundableException } from '../exceptions/order-not-refundable.exception';
import { PartialRefundUnsupportedException } from '../exceptions/partial-refund-unsupported.exception';

@Injectable()
export class OrderModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly issuedTickets: IssuedTicketsService,
  ) {}

  async refund(order: Order, amountMinor: number): Promise<Order> {
    if (order.status !== 'paid') {
      throw new OrderNotRefundableException(order.status);
    }

    if (BigInt(amountMinor) !== order.totalMinor) {
      throw new PartialRefundUnsupportedException();
    }

    const payment = order.paymentId
      ? await this.prisma.payment.findUnique({ where: { id: order.paymentId } })
      : null;

    if (payment?.status === 'successful') {
      await this.payments.refundWithProvider(payment, Number(order.totalMinor));
    }

    return this.prisma.$transaction(async (tx) => {
      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'refunded', refundedAt: new Date() },
        });
      }

      await this.issuedTickets.revokeUnscannedForOrder(tx, order.id);
      await this.orders.reverseEventRevenue(
        tx,
        order.eventId,
        order.subtotalMinor,
      );

      const event = await tx.event.findUniqueOrThrow({
        where: { id: order.eventId },
        select: { organisationId: true },
      });

      await this.ledger.recordRefund(tx, {
        organisationId: event.organisationId,
        orderId: order.id,
        amountMinor: Number(order.subtotalMinor),
        currency: order.currency,
      });

      return tx.order.update({
        where: { id: order.id },
        data: { status: 'refunded', refundedAt: new Date() },
      });
    });
  }

  async cancel(order: Order): Promise<Order> {
    return this.orders.cancel(order.id);
  }

  async markPaid(order: Order): Promise<Order> {
    if (order.status !== 'pending') {
      throw new OrderNotMarkPayableException(order.status);
    }

    await this.orders.fulfill(order.id);

    if (order.paymentId !== null) {
      await this.prisma.payment.update({
        where: { id: order.paymentId },
        data: { status: 'successful', authorizedAt: new Date() },
      });
    }

    return this.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  }

  async findOrFail(orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException();
    }

    return order;
  }
}
