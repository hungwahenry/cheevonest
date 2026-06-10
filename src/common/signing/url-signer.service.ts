import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env';

@Injectable()
export class UrlSignerService {
  private readonly secret: string;
  private readonly appUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('APP_KEY', { infer: true });
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/$/, '');
  }

  sign(path: string, ttlSeconds: number): string {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = this.signature(path, expires);

    return `${this.appUrl}${path}?expires=${expires}&signature=${signature}`;
  }

  verify(path: string, expires?: string, signature?: string): boolean {
    if (!expires || !signature || !/^\d+$/.test(expires)) {
      return false;
    }

    if (Number(expires) < Math.floor(Date.now() / 1000)) {
      return false;
    }

    const expected = Buffer.from(this.signature(path, Number(expires)), 'hex');
    const provided = Buffer.from(signature, 'hex');

    return (
      expected.length === provided.length && timingSafeEqual(expected, provided)
    );
  }

  private signature(path: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`${path}|${expires}`)
      .digest('hex');
  }
}
