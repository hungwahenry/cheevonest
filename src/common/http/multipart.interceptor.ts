import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import '@fastify/multipart';
import { UploadedFile } from './uploaded-file';

interface MultipartValue {
  type: 'field' | 'file';
  value?: unknown;
  filename?: string;
  mimetype?: string;
  toBuffer?: () => Promise<Buffer>;
}

type Container = Record<string, unknown> | unknown[];

@Injectable()
export class MultipartInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (request.isMultipart?.() && request.body) {
      request.body = await this.normalize(
        request.body as Record<string, unknown>,
      );
    }

    return next.handle();
  }

  /** Rebuilds multipart fields into plain values, supporting PHP-style bracket keys. */
  private async normalize(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const normalized: Record<string, unknown> = {};

    for (const [rawKey, rawValue] of Object.entries(body)) {
      const segments = this.parseSegments(rawKey);
      const parts = Array.isArray(rawValue) ? rawValue : [rawValue];

      for (const part of parts) {
        const resolved = await this.resolvePart(part as MultipartValue);

        if (resolved === undefined) {
          continue;
        }

        if (segments.length === 1) {
          this.assignFlat(normalized, segments[0], resolved);
        } else {
          this.assignDeep(normalized, segments, resolved);
        }
      }
    }

    return normalized;
  }

  private parseSegments(key: string): string[] {
    const match = /^([^[\]]+)((?:\[[^[\]]*\])*)$/.exec(key);

    if (!match || !match[2]) {
      return [key];
    }

    const segments = [match[1]];

    for (const bracket of match[2].matchAll(/\[([^[\]]*)\]/g)) {
      segments.push(bracket[1]);
    }

    return segments;
  }

  private assignFlat(
    target: Record<string, unknown>,
    key: string,
    value: unknown,
  ): void {
    if (key in target) {
      const existing = target[key];
      target[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
      return;
    }

    target[key] = value;
  }

  private assignDeep(
    target: Record<string, unknown>,
    segments: string[],
    value: unknown,
  ): void {
    let node: Container = target;

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;

      if (isLast) {
        if (segment === '' && Array.isArray(node)) {
          node.push(value);
        } else if (Array.isArray(node)) {
          node[Number(segment)] = value;
        } else {
          node[segment] = value;
        }
        return;
      }

      const childIsArray =
        segments[i + 1] === '' || /^\d+$/.test(segments[i + 1]);
      node = this.childContainer(node, segment, childIsArray);
    }
  }

  private childContainer(
    node: Container,
    segment: string,
    childIsArray: boolean,
  ): Container {
    const create = (): Container => (childIsArray ? [] : {});

    if (segment === '' && Array.isArray(node)) {
      const child = create();
      node.push(child);
      return child;
    }

    const key = Array.isArray(node) ? Number(segment) : segment;
    const holder = node as Record<string | number, unknown>;

    if (typeof holder[key] !== 'object' || holder[key] === null) {
      holder[key] = create();
    }

    return holder[key] as Container;
  }

  private async resolvePart(part: MultipartValue): Promise<unknown> {
    if (part === null || typeof part !== 'object') {
      return part;
    }

    if (part.type === 'file' && typeof part.toBuffer === 'function') {
      if (!part.filename) {
        return undefined;
      }

      const buffer = await part.toBuffer();

      const file: UploadedFile = {
        buffer,
        filename: part.filename,
        mimetype: part.mimetype ?? 'application/octet-stream',
        size: buffer.length,
      };

      return file;
    }

    if (part.type === 'field') {
      return part.value;
    }

    return part;
  }
}
