import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  isUploadedFile,
  type UploadedFile,
} from '../../../../common/http/uploaded-file';
import { ApiResult } from '../../../../common/responses/api-result';
import { StorageService } from '../../../../integrations/storage/storage.service';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { WelcomeService } from '../../../platform/welcome/welcome.service';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { AdminContentSerializer } from '../serializers/admin-content.serializer';

interface UpdateWelcomeBody {
  headline?: string;
  subheadline?: string;
  background?: UploadedFile;
  remove_background?: string;
}

@Roles('admin')
@Controller('admin/welcome')
export class AdminWelcomeController {
  constructor(
    private readonly welcome: WelcomeService,
    private readonly storage: StorageService,
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
    @Body() body: UpdateWelcomeBody,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const current = await this.welcome.content();

    let backgroundPath: string | null | undefined;
    if (isUploadedFile(body.background)) {
      backgroundPath = await this.storage.put(body.background, 'welcome');
    } else if (body.remove_background === 'true') {
      backgroundPath = null;
    }

    if (backgroundPath !== undefined && current.backgroundPath) {
      await this.storage.delete(current.backgroundPath).catch(() => undefined);
    }

    const updated = await this.welcome.update({
      headline: body.headline,
      subheadline: body.subheadline,
      backgroundPath,
    });

    audit({
      payload: {
        headline: updated.headline,
        background_changed: backgroundPath !== undefined,
      },
    });

    return new ApiResult(this.serializer.welcome(updated), 'Welcome updated.');
  }
}
