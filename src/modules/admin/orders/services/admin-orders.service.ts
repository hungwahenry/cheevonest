import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { OrderStatus } from '../../../../generated/prisma/client';

export const ADMIN_ORDER_INCLUDE = {
  user: { include: { profile: true } },
  event: true,
  items: true,
} satisfies Prisma.OrderInclude;

export type AdminOrder = Prisma.OrderGetPayload<{
  include: typeof ADMIN_ORDER_INCLUDE;
}>;

export const ADMIN_ORDER_DETAIL_INCLUDE = {
  ...ADMIN_ORDER_INCLUDE,
  payment: true,
  issuedTickets: true,
} satisfies Prisma.OrderInclude;

export type AdminOrderDetail = Prisma.OrderGetPayload<{
  include: typeof ADMIN_ORDER_DETAIL_INCLUDE;
}>;

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    status?: OrderStatus;
    eventId?: string;
  }): Promise<{ items: AdminOrder[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.eventId ? { eventId: options.eventId } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: ADMIN_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async detail(orderId: string): Promise<AdminOrderDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ADMIN_ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException();
    }

    return order;
  }
}
