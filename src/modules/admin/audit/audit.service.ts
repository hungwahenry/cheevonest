import { Injectable, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

export interface AuditContext {
  adminUserId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Best-effort: an audit-log failure must never fail the admin operation it records. */
  async record(context: AuditContext): Promise<void> {
    try {
      await this.prisma.adminAction.create({
        data: {
          id: ulid(),
          adminUserId: context.adminUserId,
          action: context.action,
          targetType: context.targetType?.slice(0, 64) ?? null,
          targetId: context.targetId ?? null,
          payload:
            context.payload && Object.keys(context.payload).length > 0
              ? (context.payload as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          reason: context.reason ?? null,
          ip: context.ip?.slice(0, 45) ?? null,
          userAgent: context.userAgent?.slice(0, 1024) ?? null,
          requestId: context.requestId?.slice(0, 26) ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record admin action "${context.action}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
