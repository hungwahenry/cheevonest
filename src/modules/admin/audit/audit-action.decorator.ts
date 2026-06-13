import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'admin:audit_action';

/** Tags an admin handler so the AuditInterceptor records it after a successful run. */
export const AuditAction = (action: string) =>
  SetMetadata(AUDIT_ACTION_KEY, action);
