import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ulid } from 'ulid';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import type { AccessToken } from '../../../generated/prisma/client';

@Injectable()
export class TokenService {
  private readonly ttlMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMinutes = config.get('AUTH_TOKEN_TTL_MINUTES', { infer: true });
  }

  async issue(userId: string, name = 'auth'): Promise<string> {
    const id = ulid();
    const secret = randomBytes(30).toString('base64url');

    await this.prisma.accessToken.create({
      data: {
        id,
        userId,
        name,
        tokenHash: this.hash(secret),
        expiresAt: new Date(Date.now() + this.ttlMinutes * 60_000),
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
