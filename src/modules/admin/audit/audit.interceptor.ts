import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { from, mergeMap, Observable } from 'rxjs';
import type { User } from '../../../generated/prisma/client';
import { AUDIT_ACTION_KEY } from './audit-action.decorator';
import { AuditService } from './audit.service';

/** Shape a handler may attach to the request so the interceptor records rich audit data. */
export interface AuditTarget {
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  reason?: string | null;
}

type AuditableRequest = FastifyRequest & {
  user?: User;
  auditTarget?: AuditTarget;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditableRequest>();

    // Record after the handler succeeds (no audit row for a failed mutation),
    // and await the write so the audit trail is durable before we respond.
    return next.handle().pipe(
      mergeMap((value: unknown) => {
        if (!request.user) {
          return from(Promise.resolve(value));
        }

        const target = request.auditTarget ?? {};
        const body = (request.body ?? {}) as Record<string, unknown>;
        const reason =
          target.reason ??
          (typeof body.reason === 'string' ? body.reason : null);

        const write = this.audit.record({
          adminUserId: request.user.id,
          action,
          targetType: target.targetType ?? null,
          targetId:
            target.targetId ??
            (request.params as Record<string, string>)?.id ??
            null,
          payload: target.payload ?? null,
          reason,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
          requestId: String(request.id),
        });

        return from(write.then(() => value));
      }),
    );
  }
}
