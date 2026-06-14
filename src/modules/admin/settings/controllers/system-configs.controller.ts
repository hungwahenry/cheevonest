import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { UpdateSystemConfigDto } from '../dto/settings.dto';
import { SettingsSerializer } from '../serializers/settings.serializer';
import { SettingsService } from '../services/settings.service';

@Roles('admin')
@Controller('admin/system-configs')
export class AdminSystemConfigsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly serializer: SettingsSerializer,
  ) {}

  @Get()
  async list(): Promise<unknown[]> {
    return (await this.settings.configs()).map((config) =>
      this.serializer.config(config),
    );
  }

  @Patch(':id')
  @AuditAction('system_configs.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSystemConfigDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const before = await this.settings.configOrFail(id);
    const updated = await this.settings.updateConfig(id, {
      value: dto.value,
      description: dto.description,
      isPublic: dto.is_public,
    });

    audit({
      targetType: 'system_config',
      targetId: updated.id,
      payload: {
        key: updated.key,
        before: this.settings.castedValue(before),
        after: this.settings.castedValue(updated),
      },
    });

    return new ApiResult(this.serializer.config(updated), 'Config updated.');
  }

  @Post(':id/reset')
  @HttpCode(200)
  @AuditAction('system_configs.reset')
  async reset(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const updated = await this.settings.resetConfig(id);

    audit({
      targetType: 'system_config',
      targetId: updated.id,
      payload: { key: updated.key },
    });

    return new ApiResult(this.serializer.config(updated), 'Config reset.');
  }
}
