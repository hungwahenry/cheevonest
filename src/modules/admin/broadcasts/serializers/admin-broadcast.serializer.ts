import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import type { BroadcastSuppression } from '../../../../generated/prisma/client';
import { AdminActionSerializer } from '../../audit/serializers/admin-action.serializer';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { AdminBroadcast } from '../services/broadcast-moderation.service';

@Injectable()
export class AdminBroadcastSerializer {
  constructor(
    private readonly refs: EntityRefBuilder,
    private readonly auditLog: AuditLogService,
    private readonly auditSerializer: AdminActionSerializer,
  ) {}

  row(broadcast: AdminBroadcast): Record<string, unknown> {
    return {
      ...this.core(broadcast),
      organisation: this.refs.organisation(broadcast.organisation),
      event: this.refs.event(broadcast.event),
      created_by: this.refs.user(broadcast.createdBy),
      ref: this.refs.broadcast(broadcast),
    };
  }

  async detail(broadcast: AdminBroadcast): Promise<Record<string, unknown>> {
    const auditTrail = await this.auditLog.forTarget('broadcast', broadcast.id);

    return {
      ...this.row(broadcast),
      body_html: broadcast.bodyHtml,
      body_text: broadcast.bodyText,
      audit_trail: auditTrail.map((row) => this.auditSerializer.action(row)),
    };
  }

  suppression(suppression: BroadcastSuppression): Record<string, unknown> {
    return {
      id: suppression.id,
      email: suppression.email,
      reason: suppression.reason,
      organisation_id: suppression.organisationId,
      created_at: suppression.createdAt.toISOString(),
    };
  }

  private core(broadcast: AdminBroadcast): Record<string, unknown> {
    return {
      id: broadcast.id,
      subject: broadcast.subject,
      audience: broadcast.audience,
      status: broadcast.status,
      recipients_count: broadcast.recipientsCount,
      sent_count: broadcast.sentCount,
      failed_count: broadcast.failedCount,
      failure_reason: broadcast.failureReason,
      sent_at: broadcast.sentAt?.toISOString() ?? null,
      created_at: broadcast.createdAt.toISOString(),
    };
  }
}
