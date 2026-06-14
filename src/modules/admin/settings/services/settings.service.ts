import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type {
  FeatureFlag,
  SystemConfig,
  SystemConfigType,
} from '../../../../generated/prisma/client';
import { SystemConfigRepository } from '../../../platform/system-config/system-config.repository';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SystemConfigRepository,
  ) {}

  // ----- feature flags -----
  flags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async updateFlag(
    id: string,
    data: { enabled?: boolean; rolloutPct?: number; isPublic?: boolean },
  ): Promise<FeatureFlag> {
    const flag = await this.flagOrFail(id);
    const updated = await this.prisma.featureFlag.update({
      where: { id: flag.id },
      data,
    });
    this.repository.invalidateFlags();
    return updated;
  }

  async flagOrFail(id: string): Promise<FeatureFlag> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) {
      throw new NotFoundException();
    }
    return flag;
  }

  // ----- system configs -----
  configs() {
    return this.prisma.systemConfig.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async updateConfig(
    id: string,
    data: { value?: unknown; description?: string | null; isPublic?: boolean },
  ): Promise<SystemConfig> {
    const config = await this.configOrFail(id);

    const updated = await this.prisma.systemConfig.update({
      where: { id: config.id },
      data: {
        ...(data.value !== undefined
          ? {
              value: {
                v: this.cast(config.type, data.value),
              } as Prisma.InputJsonValue,
            }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
      },
    });

    this.repository.invalidateConfigs();
    return updated;
  }

  /** Restore a config to its seeded default value. */
  async resetConfig(id: string): Promise<SystemConfig> {
    const config = await this.configOrFail(id);
    const updated = await this.prisma.systemConfig.update({
      where: { id: config.id },
      data: {
        value: config.defaultValue ?? { v: null },
      },
    });
    this.repository.invalidateConfigs();
    return updated;
  }

  async configOrFail(id: string): Promise<SystemConfig> {
    const config = await this.prisma.systemConfig.findUnique({ where: { id } });
    if (!config) {
      throw new NotFoundException();
    }
    return config;
  }

  castedValue(config: SystemConfig): unknown {
    const raw = (config.value as { v?: unknown })?.v ?? null;
    return raw;
  }

  private cast(type: SystemConfigType, value: unknown): unknown {
    switch (type) {
      case 'bool':
        return (
          value === true || value === 'true' || value === 1 || value === '1'
        );
      case 'int':
        return Math.trunc(Number(value));
      case 'decimal':
        return Number(value);
      case 'string':
        return String(value);
      case 'json':
        return value;
    }
  }
}
