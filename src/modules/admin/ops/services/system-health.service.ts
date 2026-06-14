import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { SearchIndexerService } from '../../../search/services/search-indexer.service';

export interface SystemHealth {
  database: { ok: boolean; latencyMs: number | null };
  search: Record<string, number>;
  push: {
    tokens: number;
    devices: number;
    staleTokens: number;
  };
}

const PUSH_STALE_DAYS = 60;

@Injectable()
export class SystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchIndexerService,
  ) {}

  async snapshot(): Promise<SystemHealth> {
    return {
      database: await this.database(),
      search: await this.search.health(),
      push: await this.push(),
    };
  }

  private async database(): Promise<{ ok: boolean; latencyMs: number | null }> {
    const startedAt = process.hrtime.bigint();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const elapsed = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      return { ok: true, latencyMs: Math.round(elapsed) };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }

  private async push(): Promise<SystemHealth['push']> {
    const staleBefore = new Date(Date.now() - PUSH_STALE_DAYS * 24 * 3_600_000);

    const [tokens, devices, staleTokens] = await Promise.all([
      this.prisma.expoPushToken.count(),
      this.prisma.expoPushToken
        .findMany({ distinct: ['userId'], select: { userId: true } })
        .then((rows) => rows.length),
      this.prisma.expoPushToken.count({
        where: {
          OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: staleBefore } }],
        },
      }),
    ]);

    return { tokens, devices, staleTokens };
  }
}
