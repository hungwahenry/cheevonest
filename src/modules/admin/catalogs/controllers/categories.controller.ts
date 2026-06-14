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
import { UpsertCategoryDto } from '../dto/catalog.dto';
import { CatalogSerializer } from '../serializers/catalog.serializer';
import { CatalogService } from '../services/catalog.service';

@Roles('admin')
@Controller('admin/organisation-categories')
export class AdminCategoriesController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly serializer: CatalogSerializer,
  ) {}

  @Get()
  async list(): Promise<unknown[]> {
    return (await this.catalog.categories()).map((c) =>
      this.serializer.category(c),
    );
  }

  @Post()
  @HttpCode(201)
  @AuditAction('organisation_categories.create')
  async create(
    @Body() dto: UpsertCategoryDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const created = await this.catalog.createCategory({
      slug: dto.slug!,
      name: dto.name!,
      sortOrder: dto.sort_order,
    });
    audit({
      targetType: 'organisation_category',
      targetId: String(created.id),
    });
    return new ApiResult(
      this.serializer.category(created),
      'Category created.',
    );
  }

  @Patch(':id')
  @AuditAction('organisation_categories.update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertCategoryDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const updated = await this.catalog.updateCategory(id, {
      slug: dto.slug,
      name: dto.name,
      sortOrder: dto.sort_order,
      isActive: dto.is_active,
    });
    audit({ targetType: 'organisation_category', targetId: String(id) });
    return new ApiResult(
      this.serializer.category(updated),
      'Category updated.',
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('organisation_categories.delete')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    await this.catalog.deleteCategory(id);
    audit({ targetType: 'organisation_category', targetId: String(id) });
    return new ApiResult(null, 'Category deleted.');
  }
}
