import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Payment } from '../../../../generated/prisma/client';
import { PaymentsService } from '../../../payments/services/payments.service';
import { PaymentAlreadyFinalizedException } from '../exceptions/payment-already-finalized.exception';

const TERMINAL = ['successful', 'failed', 'abandoned', 'refunded'];

@Injectable()
export class PaymentModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /** Pull the truth from the provider and re-apply it. */
  async resync(payment: Payment): Promise<Payment> {
    await this.payments.reconcile(payment);

    return this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }

  async markSuccess(payment: Payment): Promise<Payment> {
    if (payment.status === 'successful') {
      return payment;
    }

    if (TERMINAL.includes(payment.status)) {
      throw new PaymentAlreadyFinalizedException(payment.status);
    }

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'successful', authorizedAt: new Date() },
    });
  }

  async findOrFail(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException();
    }

    return payment;
  }
}
