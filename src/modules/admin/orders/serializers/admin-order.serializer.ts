import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import { AdminActionSerializer } from '../../audit/serializers/admin-action.serializer';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { AdminOrder, AdminOrderDetail } from '../services/admin-orders.service';

@Injectable()
export class AdminOrderSerializer {
  constructor(
    private readonly refs: EntityRefBuilder,
    private readonly auditLog: AuditLogService,
    private readonly auditSerializer: AdminActionSerializer,
  ) {}

  row(order: AdminOrder): Record<string, unknown> {
    return {
      ...this.core(order),
      buyer: this.refs.user(order.user),
      event: this.refs.event(order.event),
      ref: this.refs.order(order),
    };
  }

  async detail(order: AdminOrderDetail): Promise<Record<string, unknown>> {
    const auditTrail = await this.auditLog.forTarget('order', order.id);

    return {
      ...this.core(order),
      buyer: this.refs.user(order.user),
      event: this.refs.event(order.event),
      payment: order.payment ? this.refs.payment(order.payment) : null,
      items: order.items.map((item) => ({
        id: item.id,
        ticket_name: item.ticketName,
        quantity: item.quantity,
        unit_price_minor: Number(item.unitPriceMinor),
        subtotal_minor: Number(item.subtotalMinor),
      })),
      issued_tickets: order.issuedTickets.map((ticket) => ({
        id: ticket.id,
        code: ticket.code,
        status: ticket.status,
      })),
      audit_trail: auditTrail.map((row) => this.auditSerializer.action(row)),
    };
  }

  private core(order: AdminOrder): Record<string, unknown> {
    return {
      id: order.id,
      status: order.status,
      subtotal_minor: Number(order.subtotalMinor),
      fees_minor: Number(order.feesMinor),
      total_minor: Number(order.totalMinor),
      currency: order.currency,
      items_count: order.itemsQuantityTotal,
      paid_at: order.paidAt?.toISOString() ?? null,
      cancelled_at: order.cancelledAt?.toISOString() ?? null,
      refunded_at: order.refundedAt?.toISOString() ?? null,
      created_at: order.createdAt.toISOString(),
    };
  }
}
