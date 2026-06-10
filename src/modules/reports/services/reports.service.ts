import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type {
  Report,
  ReportReason,
  User,
} from '../../../generated/prisma/client';
import {
  REPORT_CREATED,
  ReportCreatedEvent,
} from '../events/report-created.event';
import { ReportRules } from '../rules/report.rules';
import { ReportAlreadyExistsException } from '../exceptions/report-already-exists.exception';
import { ReportDetailsRequiredException } from '../exceptions/report-details-required.exception';
import { ReportInvalidReasonException } from '../exceptions/report-invalid-reason.exception';
import { ReportSelfTargetException } from '../exceptions/report-self-target.exception';

export const REPORT_TARGET_TYPES = [
  'event',
  'organisation',
  'user',
  'event_comment',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export interface CreateReportInput {
  target_type: string;
  target_id: string;
  report_reason_id: string;
  details?: string | null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: ReportRules,
    private readonly emitter: EventEmitter2,
  ) {}

  async create(reporter: User, input: CreateReportInput): Promise<Report> {
    await this.rules.ensureCooldownPassed(reporter);
    await this.rules.ensureDailyCapNotReached(reporter);

    const targetType = input.target_type as ReportTargetType;
    await this.rules.ensureTargetExists(targetType, input.target_id);

    const reason = await this.resolveReason(input.report_reason_id, targetType);

    const details = input.details?.trim() ?? '';

    if (reason.requiresDetails && details === '') {
      throw new ReportDetailsRequiredException();
    }

    if (await this.isSelfReport(reporter, targetType, input.target_id)) {
      throw new ReportSelfTargetException();
    }

    try {
      const report = await this.prisma.report.create({
        data: {
          id: ulid(),
          targetType,
          targetId: input.target_id,
          reporterUserId: reporter.id,
          reportReasonId: reason.id,
          details: details === '' ? null : details,
        },
      });

      await this.emitter.emitAsync(
        REPORT_CREATED,
        new ReportCreatedEvent(report.id, report.targetType, report.targetId),
      );

      return report;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ReportAlreadyExistsException();
      }

      throw error;
    }
  }

  async reasonsForTarget(targetType: string): Promise<ReportReason[]> {
    const reasons = await this.prisma.reportReason.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return reasons.filter((reason) => {
      const scopes = Array.isArray(reason.scopeTypes)
        ? (reason.scopeTypes as string[])
        : [];

      return scopes.length === 0 || scopes.includes(targetType);
    });
  }

  private async resolveReason(
    reasonId: string,
    targetType: ReportTargetType,
  ): Promise<ReportReason> {
    const reason = await this.prisma.reportReason.findFirst({
      where: { id: reasonId, isActive: true },
    });

    if (!reason) {
      throw new ReportInvalidReasonException();
    }

    const scopes = Array.isArray(reason.scopeTypes)
      ? (reason.scopeTypes as string[])
      : [];

    if (scopes.length > 0 && !scopes.includes(targetType)) {
      throw new ReportInvalidReasonException();
    }

    return reason;
  }

  private async isSelfReport(
    reporter: User,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<boolean> {
    switch (targetType) {
      case 'event': {
        const membership = await this.prisma.organisationMember.findFirst({
          where: {
            userId: reporter.id,
            organisation: { events: { some: { id: targetId } } },
          },
          select: { userId: true },
        });

        return membership !== null;
      }
      case 'organisation': {
        const membership = await this.prisma.organisationMember.findUnique({
          where: {
            organisationId_userId: {
              organisationId: targetId,
              userId: reporter.id,
            },
          },
          select: { userId: true },
        });

        return membership !== null;
      }
      case 'user':
        return targetId === reporter.id;
      case 'event_comment': {
        const comment = await this.prisma.eventComment.findUnique({
          where: { id: targetId },
          select: { userId: true },
        });

        return comment?.userId === reporter.id;
      }
    }
  }
}
