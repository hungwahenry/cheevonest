import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ulid } from 'ulid';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { Event, Order, User } from '../../../generated/prisma/client';
import { lockEventTicket, lockOrder } from '../../../generated/prisma/sql';
import { OrganisationSuspendedException } from '../../organisations/exceptions/organisation-suspended.exception';
import { PaymentsService } from '../../payments/services/payments.service';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { IssuedTicketsService } from '../../tickets/services/issued-tickets.service';
import { ORDER_PAID, OrderPaidEvent } from '../events/order-paid.event';
import { OrderHasNoPaymentException } from '../exceptions/order-has-no-payment.exception';
import { OrderWindowRules } from '../rules/order-window.rules';
import { TicketAvailabilityRules } from '../rules/ticket-availability.rules';
import { ORDER_PURPOSABLE, OrderChannel } from '../orders.constants';
import { OrderPricingService } from './order-pricing.service';

export const ORDER_RESOURCE_INCLUDE = {
  items: true,
  issuedTickets: true,
} satisfies Prisma.OrderInclude;

export type OrderForResource = Prisma.OrderGetPayload<{
  include: typeof ORDER_RESOURCE_INCLUDE;
}>;

export interface OrderItemInput {
  ticket_id: string;
  quantity: number;
}

export interface CheckoutResult {
  order: OrderForResource;
  authorizationUrl: string | null;
}

export interface OrderPage {
  items: Array<Prisma.OrderGetPayload<{ include: { items: true } }>>;
  total: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly issuedTickets: IssuedTicketsService,
    private readonly pricing: OrderPricingService,
    private readonly systemConfig: SystemConfigService,
    private readonly windowRules: OrderWindowRules,
    private readonly availability: TicketAvailabilityRules,
    private readonly emitter: EventEmitter2,
  ) {}

  async create(
    user: User,
    event: Event,
    items: OrderItemInput[],
    callbackUrl: string,
    providerName?: string | null,
    channel: OrderChannel = 'app',
  ): Promise<CheckoutResult> {
    this.windowRules.ensureEventOpenForSales(event);
    await this.windowRules.ensurePresaleAccess(event, user.id);

    const seller = await this.prisma.organisation.findUnique({
      where: { id: event.organisationId },
      select: { suspendedAt: true },
    });
    if (seller?.suspendedAt != null) {
      throw new OrganisationSuspendedException();
    }

    if (items.length === 0) {
      throw new ValidationFailedException({
        items: ['Pick at least one ticket.'],
      });
    }

    const accessToken =
      channel === 'web' ? randomBytes(24).toString('base64url') : null;

    const holdTtlMinutes = await this.systemConfig.int(
      'orders.hold_ttl_minutes',
      10,
    );

    const orderId = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const holdsExpireAt = new Date(now.getTime() + holdTtlMinutes * 60_000);

      const lines: Array<{
        ticketId: string;
        ticketName: string;
        quantity: number;
        unitPriceMinor: number;
        subtotalMinor: number;
      }> = [];
      let subtotal = 0;

      for (const item of items) {
        await tx.$queryRawTyped(lockEventTicket(item.ticket_id, event.id));

        const found = await tx.eventTicket.findFirst({
          where: { id: item.ticket_id, eventId: event.id },
        });

        const ticket = await this.availability.ensureBuyable(
          tx,
          found,
          item.quantity,
          now,
          user.id,
        );

        const lineSubtotal = ticket.grossPrice * item.quantity;
        subtotal += lineSubtotal;

        lines.push({
          ticketId: ticket.id,
          ticketName: ticket.name,
          quantity: item.quantity,
          unitPriceMinor: ticket.grossPrice,
          subtotalMinor: lineSubtotal,
        });
      }

      const fees = await this.pricing.fees(subtotal, channel);
      const id = ulid();

      await tx.order.create({
        data: {
          id,
          userId: user.id,
          eventId: event.id,
          status: 'pending',
          subtotalMinor: subtotal,
          feesMinor: fees,
          totalMinor: subtotal + fees,
          itemsQuantityTotal: lines.reduce(
            (sum, line) => sum + line.quantity,
            0,
          ),
          currency: event.currency,
          ...(accessToken ? { accessToken } : {}),
        },
      });

      for (const line of lines) {
        await tx.orderItem.create({
          data: {
            id: ulid(),
            orderId: id,
            eventTicketId: line.ticketId,
            quantity: line.quantity,
            unitPriceMinor: line.unitPriceMinor,
            subtotalMinor: line.subtotalMinor,
            ticketName: line.ticketName,
          },
        });

        await tx.ticketHold.create({
          data: {
            id: ulid(),
            eventTicketId: line.ticketId,
            orderId: id,
            quantity: line.quantity,
            expiresAt: holdsExpireAt,
          },
        });
      }

      return id;
    });

    const order = await this.loadForResource(orderId);

    if (order.totalMinor === 0n) {
      const fulfilled = await this.fulfill(order.id);

      return { order: fulfilled, authorizationUrl: null };
    }

    // Outside the transaction so a slow provider call doesn't hold row locks.
    const started = await this.payments.start({
      user,
      amountMinor: Number(order.totalMinor),
      currency: event.currency,
      callbackUrl: accessToken
        ? `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}token=${accessToken}`
        : callbackUrl,
      purposableType: ORDER_PURPOSABLE,
      purposableId: order.id,
      metadata: { order_id: order.id },
      providerName,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentId: started.payment.id },
    });

    return {
      order: await this.loadForResource(order.id),
      authorizationUrl: started.authorizationUrl,
    };
  }

  /** Idempotent: issues tickets, applies counters, flips to paid — no-ops on non-pending orders. */
  async fulfill(orderId: string): Promise<OrderForResource> {
    const paid = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockOrder(orderId));

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });

      if (order.status !== 'pending') {
        return null;
      }

      await this.issuedTickets.issueForOrder(tx, order, order.items);

      await tx.ticketHold.deleteMany({ where: { orderId: order.id } });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'paid', paidAt: new Date() },
      });

      await tx.event.update({
        where: { id: order.eventId },
        data: { revenueMinor: { increment: order.subtotalMinor } },
      });

      const firstSale = await tx.event.updateMany({
        where: { id: order.eventId, firstSaleNotifiedAt: null },
        data: { firstSaleNotifiedAt: new Date() },
      });

      return { orderId: order.id, isFirstSale: firstSale.count > 0 };
    });

    if (paid !== null) {
      await this.emitter.emitAsync(
        ORDER_PAID,
        new OrderPaidEvent(paid.orderId, paid.isFirstSale),
      );
    }

    return this.loadForResource(orderId);
  }

  /** Reverses the revenue cache that fulfill() added — used by an admin refund. */
  async reverseEventRevenue(
    tx: Prisma.TransactionClient,
    eventId: string,
    subtotalMinor: bigint,
  ): Promise<void> {
    await tx.event.updateMany({
      where: { id: eventId, revenueMinor: { gte: subtotalMinor } },
      data: { revenueMinor: { decrement: subtotalMinor } },
    });
  }

  async cancel(orderId: string): Promise<OrderForResource> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockOrder(orderId));

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      if (order.status !== 'pending') {
        return;
      }

      await tx.ticketHold.deleteMany({ where: { orderId: order.id } });
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
    });

    return this.loadForResource(orderId);
  }

  /** Pull-verifies the order's payment with the provider; fulfillment follows via the settled event. */
  async verifyWithProvider(
    order: Order,
    lookupKey?: string | null,
  ): Promise<OrderForResource> {
    if (order.paymentId === null) {
      throw new OrderHasNoPaymentException();
    }

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: order.paymentId },
    });

    await this.payments.reconcile(payment, lookupKey);

    return this.loadForResource(order.id);
  }

  async listFor(
    userId: string,
    page: number,
    perPage: number,
  ): Promise<OrderPage> {
    const where = { userId };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total };
  }

  async expireHolds(): Promise<number> {
    const deleted = await this.prisma.ticketHold.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });

    return deleted.count;
  }

  /** Pending orders whose event ended or whose holds all expired get cancelled. */
  async cancelStalePending(): Promise<number> {
    const now = new Date();
    const stale = await this.prisma.order.findMany({
      where: {
        status: 'pending',
        OR: [
          { event: { endsAt: { lt: now } } },
          { holds: { none: { expiresAt: { gt: now } } } },
        ],
      },
      select: { id: true },
    });

    for (const order of stale) {
      await this.cancel(order.id);
    }

    return stale.length;
  }

  async findOwnedOrFail(orderId: string, userId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException();
    }

    return order;
  }

  async findByAccessTokenOrFail(token: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { accessToken: token },
    });

    if (!order) {
      throw new NotFoundException();
    }

    return order;
  }

  async loadForResource(orderId: string): Promise<OrderForResource> {
    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: ORDER_RESOURCE_INCLUDE,
    });
  }
}
