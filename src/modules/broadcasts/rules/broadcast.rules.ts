import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Event } from '../../../generated/prisma/client';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { BroadcastCooldownActiveException } from '../exceptions/broadcast-cooldown-active.exception';
import { BroadcastDailyCapReachedException } from '../exceptions/broadcast-daily-cap-reached.exception';
import { BroadcastLimitReachedException } from '../exceptions/broadcast-limit-reached.exception';

const COMMITTED_STATUSES = ['queued', 'sending', 'sent'] as const;

@Injectable()
export class BroadcastRules {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async quota(event: Event): Promise<{
    used: number;
    limit: number;
    cooldownMinutes: number;
    cooldownUntil: Date | null;
  }> {
    const [limit, cooldownMinutes, used, latest] = await Promise.all([
      this.systemConfig.int('broadcasts.max_per_event', 3),
      this.systemConfig.int('broadcasts.cooldown_minutes', 720),
      this.prisma.broadcast.count({
        where: { eventId: event.id, status: { in: [...COMMITTED_STATUSES] } },
      }),
      this.prisma.broadcast.findFirst({
        where: { eventId: event.id, status: { in: [...COMMITTED_STATUSES] } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const cooldownUntil = latest
      ? new Date(latest.createdAt.getTime() + cooldownMinutes * 60_000)
      : null;

    return {
      used,
      limit,
      cooldownMinutes,
      cooldownUntil:
        cooldownUntil && cooldownUntil > new Date() ? cooldownUntil : null,
    };
  }

  async ensureWithinPerEventLimit(event: Event): Promise<void> {
    const limit = await this.systemConfig.int('broadcasts.max_per_event', 3);

    const existing = await this.prisma.broadcast.count({
      where: { eventId: event.id, status: { in: [...COMMITTED_STATUSES] } },
    });

    if (existing >= limit) {
      throw new BroadcastLimitReachedException(limit);
    }
  }

  async ensureCooldownPassed(event: Event): Promise<void> {
    const cooldownMinutes = await this.systemConfig.int(
      'broadcasts.cooldown_minutes',
      720,
    );

    const latest = await this.prisma.broadcast.findFirst({
      where: { eventId: event.id, status: { in: [...COMMITTED_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return;
    }

    const unlockAt = new Date(
      latest.createdAt.getTime() + cooldownMinutes * 60_000,
    );

    if (unlockAt > new Date()) {
      throw new BroadcastCooldownActiveException(unlockAt.toISOString());
    }
  }

  async ensureDailyCapNotReached(organisationId: string): Promise<void> {
    const cap = await this.systemConfig.int(
      'broadcasts.daily_volume_cap_per_org',
      5000,
    );

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const sentToday = await this.prisma.broadcast.aggregate({
      where: { organisationId, createdAt: { gte: dayStart } },
      _sum: { recipientsCount: true },
    });

    if ((sentToday._sum.recipientsCount ?? 0) >= cap) {
      throw new BroadcastDailyCapReachedException(cap);
    }
  }
}
