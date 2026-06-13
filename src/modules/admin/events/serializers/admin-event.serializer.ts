import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import type { EventTicket } from '../../../../generated/prisma/client';
import { AdminActionSerializer } from '../../audit/serializers/admin-action.serializer';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { AdminEvent } from '../services/admin-events.service';

type OrderRow = Parameters<EntityRefBuilder['order']>[0] & {
  user: Parameters<EntityRefBuilder['user']>[0];
};

@Injectable()
export class AdminEventSerializer {
  constructor(
    private readonly refs: EntityRefBuilder,
    private readonly auditLog: AuditLogService,
    private readonly auditSerializer: AdminActionSerializer,
  ) {}

  row(event: AdminEvent): Record<string, unknown> {
    return {
      ...this.core(event),
      organisation: this.refs.organisation(event.organisation),
      ref: this.refs.event(event),
    };
  }

  async detail(data: {
    event: AdminEvent;
    stats: Record<string, number>;
    ordersRecent: OrderRow[];
    ticketTypes: EventTicket[];
  }): Promise<Record<string, unknown>> {
    const auditTrail = await this.auditLog.forTarget('event', data.event.id);

    return {
      ...this.core(data.event),
      organisation: this.refs.organisation(data.event.organisation),
      stats: data.stats,
      orders_recent: data.ordersRecent.map((order) => ({
        ...this.refs.order(order),
        total_minor: Number(order.totalMinor),
        buyer: this.refs.user(order.user),
        created_at: order.createdAt.toISOString(),
      })),
      ticket_types: data.ticketTypes.map((ticket) => ({
        id: ticket.id,
        name: ticket.name,
        status: ticket.status,
        gross_price: ticket.grossPrice,
        sold_count: ticket.soldCount,
        quantity: ticket.quantity,
      })),
      audit_trail: auditTrail.map((row) => this.auditSerializer.action(row)),
    };
  }

  private core(event: AdminEvent): Record<string, unknown> {
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      status: event.status,
      starts_at: event.startsAt?.toISOString() ?? null,
      ends_at: event.endsAt?.toISOString() ?? null,
      comments_locked_at: event.commentsLockedAt?.toISOString() ?? null,
      published_at: event.publishedAt?.toISOString() ?? null,
      created_at: event.createdAt.toISOString(),
    };
  }
}
