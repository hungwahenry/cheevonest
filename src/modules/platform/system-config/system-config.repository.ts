import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { Env } from '../../../config/env';
import { SystemConfigType } from '../../../generated/prisma/client';

export interface FlagEntry {
  enabled: boolean;
  rolloutPct: number;
  isPublic: boolean;
}

export interface ConfigEntry {
  type: SystemConfigType;
  value: unknown;
  isPublic: boolean;
}

interface CacheState<T> {
  entries: Record<string, T>;
  version: string;
  loadedAt: number;
}

/**
 * Versions derive from row data (count + latest updated_at), so ETags stay
 * stable across restarts and consistent between instances without shared cache.
 */
@Injectable()
export class SystemConfigRepository {
  private readonly ttlMs: number;
  private flagsCache: CacheState<FlagEntry> | null = null;
  private configsCache: CacheState<ConfigEntry> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs =
      config.get('SYSTEM_CONFIG_CACHE_TTL_SECONDS', { infer: true }) * 1000;
  }

  async flags(): Promise<Record<string, FlagEntry>> {
    return (await this.loadFlags()).entries;
  }

  async flagsVersion(): Promise<string> {
    return (await this.loadFlags()).version;
  }

  async configs(): Promise<Record<string, ConfigEntry>> {
    return (await this.loadConfigs()).entries;
  }

  async configsVersion(): Promise<string> {
    return (await this.loadConfigs()).version;
  }

  invalidateFlags(): void {
    this.flagsCache = null;
  }

  invalidateConfigs(): void {
    this.configsCache = null;
  }

  private async loadFlags(): Promise<CacheState<FlagEntry>> {
    if (this.flagsCache && !this.isStale(this.flagsCache)) {
      return this.flagsCache;
    }

    const rows = await this.prisma.featureFlag.findMany({
      select: {
        key: true,
        enabled: true,
        rolloutPct: true,
        isPublic: true,
        updatedAt: true,
      },
    });

    const entries: Record<string, FlagEntry> = {};

    for (const row of rows) {
      entries[row.key] = {
        enabled: row.enabled,
        rolloutPct: row.rolloutPct,
        isPublic: row.isPublic,
      };
    }

    this.flagsCache = {
      entries,
      version: this.version(rows),
      loadedAt: Date.now(),
    };

    return this.flagsCache;
  }

  private async loadConfigs(): Promise<CacheState<ConfigEntry>> {
    if (this.configsCache && !this.isStale(this.configsCache)) {
      return this.configsCache;
    }

    const rows = await this.prisma.systemConfig.findMany({
      select: {
        key: true,
        type: true,
        value: true,
        isPublic: true,
        updatedAt: true,
      },
    });

    const entries: Record<string, ConfigEntry> = {};

    for (const row of rows) {
      entries[row.key] = {
        type: row.type,
        value: castConfigValue(
          row.type,
          (row.value as { v?: unknown } | null)?.v ?? null,
        ),
        isPublic: row.isPublic,
      };
    }

    this.configsCache = {
      entries,
      version: this.version(rows),
      loadedAt: Date.now(),
    };

    return this.configsCache;
  }

  private isStale(cache: CacheState<unknown>): boolean {
    return Date.now() - cache.loadedAt >= this.ttlMs;
  }

  private version(rows: Array<{ updatedAt: Date }>): string {
    const latest = rows.reduce(
      (max, row) => Math.max(max, row.updatedAt.getTime()),
      0,
    );

    return `${rows.length}.${latest}`;
  }
}

export function castConfigValue(type: SystemConfigType, raw: unknown): unknown {
  switch (type) {
    case 'bool':
      return Boolean(raw);
    case 'int':
      return Math.trunc(Number(raw));
    case 'decimal':
      return Number(raw);
    case 'string':
      return String(raw);
    case 'json':
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
}
