import { Injectable } from '@nestjs/common';
import { EntityRefBuilder } from '../../../../common/admin/entity-ref.builder';
import { Prisma } from '../../../../generated/prisma/client';

export const ADMIN_ACTION_INCLUDE = {
  admin: { include: { profile: true } },
} satisfies Prisma.AdminActionInclude;

export type AdminActionRow = Prisma.AdminActionGetPayload<{
  include: typeof ADMIN_ACTION_INCLUDE;
}>;

@Injectable()
export class AdminActionSerializer {
  constructor(private readonly refs: EntityRefBuilder) {}

  action(row: AdminActionRow): Record<string, unknown> {
    return {
      id: row.id,
      action: row.action,
      admin: this.refs.user(row.admin),
      target_type: row.targetType,
      target_id: row.targetId,
      payload: row.payload,
      reason: row.reason,
      ip: row.ip,
      user_agent: row.userAgent,
      request_id: row.requestId,
      created_at: row.createdAt.toISOString(),
    };
  }
}
