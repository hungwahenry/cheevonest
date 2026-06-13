import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuditTarget } from './audit.interceptor';

/** Injects a setter so a handler can hand the interceptor its target/payload/reason. */
export const AuditSink = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { auditTarget?: AuditTarget }>();

    return (target: AuditTarget): void => {
      request.auditTarget = target;
    };
  },
);

export type AuditSinkFn = (target: AuditTarget) => void;
