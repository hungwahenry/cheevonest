import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import { AdminActionSerializer } from '../../audit/serializers/admin-action.serializer';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { AdminReport } from '../services/admin-reports.service';

@Injectable()
export class AdminReportSerializer {
  constructor(
    private readonly refs: EntityRefBuilder,
    private readonly auditLog: AuditLogService,
    private readonly auditSerializer: AdminActionSerializer,
  ) {}

  row(report: AdminReport, target?: unknown): Record<string, unknown> {
    const targetType =
      report.targetType === 'event_comment'
        ? 'event_comment'
        : report.targetType;

    return {
      ...this.core(report),
      target_type: report.targetType,
      target_id: report.targetId,
      target: target ? this.refs.fromTarget(targetType, target) : null,
      reporter: this.refs.user(report.reporter),
    };
  }

  async detail(data: {
    report: AdminReport;
    target: unknown;
  }): Promise<Record<string, unknown>> {
    const auditTrail = await this.auditLog.forTarget('report', data.report.id);

    return {
      ...this.row(data.report, data.target),
      reviewed_by: data.report.reviewedBy
        ? this.refs.user(data.report.reviewedBy)
        : null,
      audit_trail: auditTrail.map((row) => this.auditSerializer.action(row)),
    };
  }

  private core(report: AdminReport): Record<string, unknown> {
    return {
      id: report.id,
      status: report.status,
      reason: { slug: report.reason.slug, label: report.reason.label },
      details: report.details,
      resolution_note: report.resolutionNote,
      reviewed_at: report.reviewedAt?.toISOString() ?? null,
      created_at: report.createdAt.toISOString(),
    };
  }
}
