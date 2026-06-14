import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { UpsertPlatformDto } from '../dto/catalog.dto';
import { CatalogSerializer } from '../serializers/catalog.serializer';
import { CatalogService } from '../services/catalog.service';

@Roles('admin')
@Controller('admin/social-platforms')
export class AdminPlatformsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly serializer: CatalogSerializer,
  ) {}

  @Get()
  async list(): Promise<unknown[]> {
    return (await this.catalog.platforms()).map((p) =>
      this.serializer.platform(p),
    );
  }

  @Post()
  @HttpCode(201)
  @AuditAction('social_platforms.create')
  async create(
    @Body() dto: UpsertPlatformDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const created = await this.catalog.createPlatform({
      slug: dto.slug!,
      name: dto.name!,
      baseUrl: dto.base_url,
      sortOrder: dto.sort_order,
    });
    audit({ targetType: 'social_platform', targetId: String(created.id) });
    return new ApiResult(
      this.serializer.platform(created),
      'Platform created.',
    );
  }

  @Patch(':id')
  @AuditAction('social_platforms.update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertPlatformDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const updated = await this.catalog.updatePlatform(id, {
      slug: dto.slug,
      name: dto.name,
      baseUrl: dto.base_url,
      sortOrder: dto.sort_order,
      isActive: dto.is_active,
    });
    audit({ targetType: 'social_platform', targetId: String(id) });
    return new ApiResult(
      this.serializer.platform(updated),
      'Platform updated.',
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('social_platforms.delete')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    await this.catalog.deletePlatform(id);
    audit({ targetType: 'social_platform', targetId: String(id) });
    return new ApiResult(null, 'Platform deleted.');
  }
}
