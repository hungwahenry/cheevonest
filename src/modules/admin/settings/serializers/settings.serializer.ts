import { Injectable } from '@nestjs/common';
import type {
  FeatureFlag,
  SystemConfig,
} from '../../../../generated/prisma/client';

@Injectable()
export class SettingsSerializer {
  flag(flag: FeatureFlag): Record<string, unknown> {
    return {
      id: flag.id,
      key: flag.key,
      description: flag.description,
      enabled: flag.enabled,
      rollout_pct: flag.rolloutPct,
      is_public: flag.isPublic,
    };
  }

  config(config: SystemConfig): Record<string, unknown> {
    return {
      id: config.id,
      key: config.key,
      group: config.group,
      type: config.type,
      description: config.description,
      value: (config.value as { v?: unknown })?.v ?? null,
      default_value: (config.defaultValue as { v?: unknown })?.v ?? null,
      is_public: config.isPublic,
    };
  }
}
