import { crc32 } from 'node:zlib';
import { Injectable } from '@nestjs/common';
import { SystemConfigRepository } from './system-config.repository';

export interface FlagIdentity {
  userId?: string | null;
  ip?: string | null;
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly repository: SystemConfigRepository) {}

  /**
   * Unknown or disabled flags are off; partial rollouts bucket deterministically
   * per (flag, identity) so the same user always gets the same answer.
   */
  async enabled(key: string, identity: FlagIdentity = {}): Promise<boolean> {
    const flag = (await this.repository.flags())[key];

    if (!flag || !flag.enabled) {
      return false;
    }

    if (flag.rolloutPct >= 100) {
      return true;
    }

    return this.bucket(key, identity) < flag.rolloutPct;
  }

  private bucket(key: string, identity: FlagIdentity): number {
    const subject = identity.userId ?? identity.ip ?? 'anon';

    return crc32(`${key}:${subject}`) % 100;
  }
}
