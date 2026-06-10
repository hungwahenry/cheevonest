import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { User } from '../../../generated/prisma/client';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { ReportCooldownActiveException } from '../exceptions/report-cooldown-active.exception';
import { ReportDailyCapReachedException } from '../exceptions/report-daily-cap-reached.exception';
import { ReportInvalidTargetException } from '../exceptions/report-invalid-target.exception';
import type { ReportTargetType } from '../services/reports.service';

@Injectable()
export class ReportRules {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async ensureCooldownPassed(reporter: User): Promise<void> {
    const cooldown = await this.systemConfig.int(
      'reports.cooldown_seconds',
      30,
    );

    if (cooldown <= 0) {
      return;
    }

    const last = await this.prisma.report.findFirst({
      where: { reporterUserId: reporter.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (!last) {
      return;
    }

    const elapsed = Math.floor((Date.now() - last.createdAt.getTime()) / 1000);

    if (elapsed < cooldown) {
      throw new ReportCooldownActiveException(cooldown - elapsed);
    }
  }

  async ensureDailyCapNotReached(reporter: User): Promise<void> {
    const cap = await this.systemConfig.int('reports.daily_cap_per_user', 20);

    if (cap <= 0) {
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const today = await this.prisma.report.count({
      where: { reporterUserId: reporter.id, createdAt: { gte: startOfDay } },
    });

    if (today >= cap) {
      throw new ReportDailyCapReachedException(cap);
    }
  }

  async ensureTargetExists(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<void> {
    const exists = await this.targetExists(targetType, targetId);

    if (!exists) {
      throw new ReportInvalidTargetException();
    }
  }

  private async targetExists(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<boolean> {
    switch (targetType) {
      case 'event':
        return (
          (await this.prisma.event.findUnique({
            where: { id: targetId },
            select: { id: true },
          })) !== null
        );
      case 'organisation':
        return (
          (await this.prisma.organisation.findUnique({
            where: { id: targetId },
            select: { id: true },
          })) !== null
        );
      case 'user':
        return (
          (await this.prisma.user.findUnique({
            where: { id: targetId },
            select: { id: true },
          })) !== null
        );
      case 'event_comment':
        return (
          (await this.prisma.eventComment.findUnique({
            where: { id: targetId },
            select: { id: true },
          })) !== null
        );
    }
  }
}
