import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { MaintenanceService } from '../services/maintenance.service';
import { SystemHealthService } from '../services/system-health.service';

@Roles('admin')
@Controller('admin/ops')
export class OpsController {
  constructor(
    private readonly health: SystemHealthService,
    private readonly maintenance: MaintenanceService,
  ) {}

  @Get('health')
  async healthCheck(): Promise<unknown> {
    return this.health.snapshot();
  }

  @Get('commands')
  commands(): Array<{ command: string; description: string }> {
    return this.maintenance.list();
  }

  @Post('commands/:command/run')
  @HttpCode(200)
  @AuditAction('ops.run_command')
  async runCommand(
    @Param('command') command: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const result = await this.maintenance.run(command);

    audit({ targetType: 'command', targetId: command, payload: { result } });

    return new ApiResult({ command, result }, 'Command executed.');
  }
}
