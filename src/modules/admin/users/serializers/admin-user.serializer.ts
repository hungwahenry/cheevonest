import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import type { AccessToken } from '../../../../generated/prisma/client';
import { UserSerializer } from '../../../users/serializers/user.serializer';
import { AdminActionSerializer } from '../../audit/serializers/admin-action.serializer';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { AdminUser } from '../services/admin-users.service';

@Injectable()
export class AdminUserSerializer {
  constructor(
    private readonly refs: EntityRefBuilder,
    private readonly users: UserSerializer,
    private readonly auditLog: AuditLogService,
    private readonly auditSerializer: AdminActionSerializer,
  ) {}

  /** Lean row for the list view — identity + the headline health flag. */
  row(user: AdminUser): Record<string, unknown> {
    return {
      ...this.account(user),
      ref: this.refs.user(user),
    };
  }

  async detail(data: {
    user: AdminUser;
    stats: Record<string, number>;
    ordersRecent: Array<
      Parameters<EntityRefBuilder['order']>[0] & {
        event: Parameters<EntityRefBuilder['event']>[0];
      }
    >;
    ticketsRecent: Array<{
      id: string;
      code: string;
      status: string;
      event: Parameters<EntityRefBuilder['event']>[0];
      ticket: { name: string };
      createdAt: Date;
    }>;
    memberships: Array<{
      role: string;
      organisation: Parameters<EntityRefBuilder['organisation']>[0];
    }>;
    sessions: AccessToken[];
  }): Promise<Record<string, unknown>> {
    const auditTrail = await this.auditLog.forTarget('user', data.user.id);

    return {
      ...this.account(data.user),
      stats: data.stats,
      organisations: data.memberships.map((membership) => ({
        ...this.refs.organisation(membership.organisation),
        role: membership.role,
      })),
      orders_recent: data.ordersRecent.map((order) => ({
        ...this.refs.order(order),
        total_minor: Number(order.totalMinor),
        event: this.refs.event(order.event),
        created_at: order.createdAt.toISOString(),
      })),
      tickets_recent: data.ticketsRecent.map((ticket) => ({
        id: ticket.id,
        code: ticket.code,
        status: ticket.status,
        ticket_name: ticket.ticket.name,
        event: this.refs.event(ticket.event),
      })),
      sessions: data.sessions.map((session) => ({
        id: session.id,
        name: session.name,
        last_used_at: session.lastUsedAt?.toISOString() ?? null,
        created_at: session.createdAt.toISOString(),
      })),
      audit_trail: auditTrail.map((row) => this.auditSerializer.action(row)),
    };
  }

  private account(user: AdminUser): Record<string, unknown> {
    const profile = user.profile;
    const displayName =
      `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
      suspended_at: user.suspendedAt?.toISOString() ?? null,
      suspended_reason: user.suspendedReason,
      created_at: user.createdAt.toISOString(),
      profile: profile
        ? {
            username: profile.username,
            display_name: displayName !== '' ? displayName : null,
            city: profile.city,
            avatar_url: this.users.avatarUrl(profile),
            completed_at: profile.completedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
}
