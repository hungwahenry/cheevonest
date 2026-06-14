import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { UpdateFeatureFlagDto } from '../dto/settings.dto';
import { SettingsSerializer } from '../serializers/settings.serializer';
import { SettingsService } from '../services/settings.service';

@Roles('admin')
@Controller('admin/feature-flags')
export class AdminFeatureFlagsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly serializer: SettingsSerializer,
  ) {}

  @Get()
  async list(): Promise<unknown[]> {
    return (await this.settings.flags()).map((flag) =>
      this.serializer.flag(flag),
    );
  }

  @Patch(':id')
  @AuditAction('feature_flags.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureFlagDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const before = await this.settings.flagOrFail(id);
    const updated = await this.settings.updateFlag(id, {
      enabled: dto.enabled,
      rolloutPct: dto.rollout_pct,
      isPublic: dto.is_public,
    });

    audit({
      targetType: 'feature_flag',
      targetId: updated.id,
      payload: {
        key: updated.key,
        before: { enabled: before.enabled, rollout_pct: before.rolloutPct },
        after: { enabled: updated.enabled, rollout_pct: updated.rolloutPct },
      },
    });

    return new ApiResult(
      this.serializer.flag(updated),
      'Feature flag updated.',
    );
  }
}
