import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ulid } from 'ulid';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import type { AccessToken } from '../../../generated/prisma/client';
import { SystemConfigService } from '../../platform/system-config/system-config.service';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async issue(userId: string, name = 'auth'): Promise<string> {
    const id = ulid();
    const secret = randomBytes(30).toString('base64url');
    const ttlMinutes = await this.systemConfig.int(
      'auth.token_ttl_minutes',
      this.config.get('AUTH_TOKEN_TTL_MINUTES', { infer: true }),
    );

    await this.prisma.accessToken.create({
      data: {
        id,
        userId,
        name,
        tokenHash: this.hash(secret),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    return `${id}|${secret}`;
  }

  async resolve(plainToken: string): Promise<AccessToken | null> {
    const [id, secret] = plainToken.split('|');

    if (!id || !secret) {
      return null;
    }

    const token = await this.prisma.accessToken.findUnique({ where: { id } });

    if (!token) {
      return null;
    }

    const expected = Buffer.from(token.tokenHash, 'hex');
    const actual = createHash('sha256').update(secret).digest();

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return null;
    }

    if (token.expiresAt !== null && token.expiresAt <= new Date()) {
      return null;
    }

    return token;
  }

  async touch(id: string): Promise<void> {
    await this.prisma.accessToken.updateMany({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.accessToken.deleteMany({ where: { id } });
  }

  async revokeAllFor(userId: string, exceptTokenId?: string): Promise<number> {
    const result = await this.prisma.accessToken.deleteMany({
      where: {
        userId,
        ...(exceptTokenId ? { id: { not: exceptTokenId } } : {}),
      },
    });

    return result.count;
  }

  private hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
