import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { ReportStatus } from '../../../../generated/prisma/client';

export const ADMIN_REPORT_INCLUDE = {
  reason: true,
  reporter: { include: { profile: true } },
  reviewedBy: { include: { profile: true } },
} satisfies Prisma.ReportInclude;

export type AdminReport = Prisma.ReportGetPayload<{
  include: typeof ADMIN_REPORT_INCLUDE;
}>;

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    status?: ReportStatus;
    targetType?: string;
  }): Promise<{ items: AdminReport[]; total: number }> {
    const where: Prisma.ReportWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.targetType ? { targetType: options.targetType } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: ADMIN_REPORT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async detail(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: ADMIN_REPORT_INCLUDE,
    });

    if (!report) {
      throw new NotFoundException();
    }

    return { report, target: await this.resolveTarget(report) };
  }

  /** Load the polymorphic target record so the serializer can build a ref. */
  async resolveTarget(report: {
    targetType: string;
    targetId: string;
  }): Promise<unknown> {
    switch (report.targetType) {
      case 'user':
        return this.prisma.user.findUnique({
          where: { id: report.targetId },
          include: { profile: true },
        });
      case 'organisation':
        return this.prisma.organisation.findUnique({
          where: { id: report.targetId },
        });
      case 'event':
        return this.prisma.event.findUnique({
          where: { id: report.targetId },
        });
      case 'event_comment':
        return this.prisma.eventComment.findUnique({
          where: { id: report.targetId },
        });
      default:
        return null;
    }
  }
}
