import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import type { Event, Order } from '../../../../generated/prisma/client';
import { AdminActionSerializer } from '../../audit/serializers/admin-action.serializer';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { AdminPayment } from '../services/admin-payments.service';

@Injectable()
export class AdminPaymentSerializer {
  constructor(
    private readonly refs: EntityRefBuilder,
    private readonly auditLog: AuditLogService,
    private readonly auditSerializer: AdminActionSerializer,
  ) {}

  row(payment: AdminPayment): Record<string, unknown> {
    return {
      ...this.core(payment),
      user: this.refs.user(payment.user),
      ref: this.refs.payment(payment),
    };
  }

  async detail(data: {
    payment: AdminPayment;
    order: (Order & { event: Event }) | null;
  }): Promise<Record<string, unknown>> {
    const auditTrail = await this.auditLog.forTarget(
      'payment',
      data.payment.id,
    );

    return {
      ...this.core(data.payment),
      user: this.refs.user(data.payment.user),
      order: data.order ? this.refs.order(data.order) : null,
      event: data.order ? this.refs.event(data.order.event) : null,
      provider_reference: data.payment.providerReference,
      provider_response: data.payment.providerResponse,
      metadata: data.payment.metadata,
      audit_trail: auditTrail.map((row) => this.auditSerializer.action(row)),
    };
  }

  private core(payment: AdminPayment): Record<string, unknown> {
    return {
      id: payment.id,
      reference: payment.reference,
      provider: payment.provider,
      status: payment.status,
      amount_minor: Number(payment.amountMinor),
      currency: payment.currency,
      authorized_at: payment.authorizedAt?.toISOString() ?? null,
      failed_at: payment.failedAt?.toISOString() ?? null,
      refunded_at: payment.refundedAt?.toISOString() ?? null,
      created_at: payment.createdAt.toISOString(),
    };
  }
}
