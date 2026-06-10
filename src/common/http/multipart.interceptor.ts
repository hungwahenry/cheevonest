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

  private async normalize(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const normalized: Record<string, unknown> = {};

    for (const [rawKey, rawValue] of Object.entries(body)) {
      const isArrayKey = rawKey.endsWith('[]');
      const key = isArrayKey ? rawKey.slice(0, -2) : rawKey;
      const parts = Array.isArray(rawValue) ? rawValue : [rawValue];

      const values: unknown[] = [];

      for (const part of parts) {
        const resolved = await this.resolvePart(part as MultipartValue);

        if (resolved !== undefined) {
          values.push(resolved);
        }
      }

      if (values.length === 0) {
        continue;
      }

      normalized[key] = isArrayKey || values.length > 1 ? values : values[0];
    }

    return normalized;
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
