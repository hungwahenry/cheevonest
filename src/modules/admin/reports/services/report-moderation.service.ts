import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Report, User } from '../../../../generated/prisma/client';

@Injectable()
export class ReportModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async startReview(report: Report, admin: User): Promise<Report> {
    return this.prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'under_review',
        reviewedByUserId: admin.id,
        reviewedAt: new Date(),
      },
    });
  }

  /** Resolve the report. action='delete_target' removes a reported comment. */
  async action(
    report: Report,
    admin: User,
    action: string,
    note: string,
  ): Promise<Report> {
    return this.prisma.$transaction(async (tx) => {
      if (action === 'delete_target' && report.targetType === 'event_comment') {
        await tx.eventComment.deleteMany({ where: { id: report.targetId } });
      }

      return tx.report.update({
        where: { id: report.id },
        data: {
          status: 'actioned',
          reviewedByUserId: admin.id,
          reviewedAt: new Date(),
          resolutionNote: note,
        },
      });
    });
  }

  async dismiss(report: Report, admin: User, note: string): Promise<Report> {
    return this.prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'dismissed',
        reviewedByUserId: admin.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    });
  }

  async bulkDismiss(ids: string[], admin: User, note: string): Promise<number> {
    const updated = await this.prisma.report.updateMany({
      where: { id: { in: ids }, status: { in: ['open', 'under_review'] } },
      data: {
        status: 'dismissed',
        reviewedByUserId: admin.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    });

    return updated.count;
  }

  async findOrFail(reportId: string): Promise<Report> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException();
    }

    return report;
  }
}
