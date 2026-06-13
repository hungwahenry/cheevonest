import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import type {
  Broadcast,
  Event,
  Payout,
} from '../../../../generated/prisma/client';
import { AdminActionSerializer } from '../../audit/serializers/admin-action.serializer';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { AdminOrganisation } from '../services/admin-organisations.service';

type Member = {
  role: string;
  user: Parameters<EntityRefBuilder['user']>[0];
};

@Injectable()
export class AdminOrganisationSerializer {
  constructor(
    private readonly refs: EntityRefBuilder,
    private readonly auditLog: AuditLogService,
    private readonly auditSerializer: AdminActionSerializer,
  ) {}

  row(organisation: AdminOrganisation): Record<string, unknown> {
    return {
      ...this.core(organisation),
      ref: this.refs.organisation(organisation),
    };
  }

  async detail(data: {
    organisation: AdminOrganisation;
    stats: Record<string, number>;
    members: Member[];
    eventsRecent: Event[];
    payoutsRecent: Payout[];
    broadcastsRecent: Broadcast[];
  }): Promise<Record<string, unknown>> {
    const auditTrail = await this.auditLog.forTarget(
      'organisation',
      data.organisation.id,
    );

    return {
      ...this.core(data.organisation),
      stats: data.stats,
      members: data.members.map((member) => ({
        ...this.refs.user(member.user),
        role: member.role,
      })),
      events_recent: data.eventsRecent.map((event) => this.refs.event(event)),
      payouts_recent: data.payoutsRecent.map((payout) => ({
        ...this.refs.payout(payout),
        amount_minor: Number(payout.amountMinor),
        requested_at: payout.requestedAt.toISOString(),
      })),
      broadcasts_recent: data.broadcastsRecent.map((broadcast) => ({
        ...this.refs.broadcast(broadcast),
        sent_count: broadcast.sentCount,
        created_at: broadcast.createdAt.toISOString(),
      })),
      audit_trail: auditTrail.map((row) => this.auditSerializer.action(row)),
    };
  }

  private core(organisation: AdminOrganisation): Record<string, unknown> {
    return {
      id: organisation.id,
      name: organisation.name,
      slug: organisation.slug,
      category: organisation.category?.name ?? null,
      contact_email: organisation.contactEmail,
      suspended_at: organisation.suspendedAt?.toISOString() ?? null,
      suspended_reason: organisation.suspendedReason,
      created_at: organisation.createdAt.toISOString(),
    };
  }
}
