import { Global, Module } from '@nestjs/common';
import { AuditLogController } from './controllers/audit-log.controller';
import { AdminActionSerializer } from './serializers/admin-action.serializer';
import { AuditLogService } from './services/audit-log.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditService, AuditLogService, AdminActionSerializer],
  exports: [AuditService, AuditLogService, AdminActionSerializer],
})
export class AuditModule {}
