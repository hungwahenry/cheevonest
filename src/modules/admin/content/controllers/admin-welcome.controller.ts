import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { WelcomeService } from '../../../platform/welcome/welcome.service';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { UpdateWelcomeDto } from '../dto/admin-content.dto';
import { AdminContentSerializer } from '../serializers/admin-content.serializer';

@Roles('admin')
@Controller('admin/welcome')
export class AdminWelcomeController {
  constructor(
    private readonly welcome: WelcomeService,
    private readonly serializer: AdminContentSerializer,
  ) {}

  @Get()
  async show(): Promise<unknown> {
    return this.serializer.welcome(await this.welcome.content());
  }

  @Post()
  @HttpCode(200)
  @AuditAction('welcome.update')
  async update(
    @Body() dto: UpdateWelcomeDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const updated = await this.welcome.update({
      headline: dto.headline,
      subheadline: dto.subheadline,
    });
    audit({ payload: { headline: updated.headline } });
    return new ApiResult(this.serializer.welcome(updated), 'Welcome updated.');
  }
}
