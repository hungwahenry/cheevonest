import { Injectable } from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async record(context: AuditContext): Promise<void> {
    await this.prisma.adminAction.create({
      data: {
        id: ulid(),
        adminUserId: context.adminUserId,
        action: context.action,
        targetType: context.targetType ?? null,
        targetId: context.targetId ?? null,
        payload:
          context.payload && Object.keys(context.payload).length > 0
            ? (context.payload as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        reason: context.reason ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent?.slice(0, 1024) ?? null,
        requestId: context.requestId ?? null,
      },
    });
  }
}
