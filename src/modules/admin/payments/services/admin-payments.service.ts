import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { PaymentStatus } from '../../../../generated/prisma/client';

export const ADMIN_PAYMENT_INCLUDE = {
  user: { include: { profile: true } },
} satisfies Prisma.PaymentInclude;

export type AdminPayment = Prisma.PaymentGetPayload<{
  include: typeof ADMIN_PAYMENT_INCLUDE;
}>;

@Injectable()
export class AdminPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    status?: PaymentStatus;
    provider?: string;
  }): Promise<{ items: AdminPayment[]; total: number }> {
    const where: Prisma.PaymentWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.provider ? { provider: options.provider } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: ADMIN_PAYMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async detail(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: ADMIN_PAYMENT_INCLUDE,
    });

    if (!payment) {
      throw new NotFoundException();
    }

    const order =
      payment.purposableType === 'order' && payment.purposableId
        ? await this.prisma.order.findUnique({
            where: { id: payment.purposableId },
            include: { event: true },
          })
        : null;

    return { payment, order };
  }
}
