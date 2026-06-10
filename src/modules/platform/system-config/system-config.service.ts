import { Injectable } from '@nestjs/common';
import { SystemConfigRepository } from './system-config.repository';

@Injectable()
export class SystemConfigService {
  constructor(private readonly repository: SystemConfigRepository) {}

  async int(key: string, fallback = 0): Promise<number> {
    const value = await this.raw(key);

    return value === null ? fallback : Math.trunc(Number(value));
  }

  async bool(key: string, fallback = false): Promise<boolean> {
    const value = await this.raw(key);

    return value === null ? fallback : Boolean(value);
  }

  async decimal(key: string, fallback = 0): Promise<number> {
    const value = await this.raw(key);

    return value === null ? fallback : Number(value);
  }

  async string(key: string, fallback = ''): Promise<string> {
    const value = await this.raw(key);

    if (value === null) {
      return fallback;
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  async array(key: string, fallback: unknown[] = []): Promise<unknown[]> {
    const value = await this.raw(key);

    return Array.isArray(value) ? (value as unknown[]) : fallback;
  }

  async has(key: string): Promise<boolean> {
    const configs = await this.repository.configs();

    return key in configs;
  }

  private async raw(key: string): Promise<unknown> {
    const configs = await this.repository.configs();

    return configs[key]?.value ?? null;
  }
}
