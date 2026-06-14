import {
  Body,
  Controller,
  Delete,
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
import { UpsertPageDto } from '../dto/admin-content.dto';
import { AdminContentSerializer } from '../serializers/admin-content.serializer';
import { AdminPagesService } from '../services/admin-pages.service';

@Roles('admin')
@Controller('admin/pages')
export class AdminPagesController {
  constructor(
    private readonly pages: AdminPagesService,
    private readonly serializer: AdminContentSerializer,
  ) {}

  @Get()
  async list(): Promise<unknown[]> {
    return (await this.pages.list()).map((page) => this.serializer.page(page));
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.page(await this.pages.findOrFail(id));
  }

  @Post()
  @HttpCode(201)
  @AuditAction('pages.create')
  async create(
    @Body() dto: UpsertPageDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const page = await this.pages.create({
      slug: dto.slug!,
      title: dto.title!,
      bodyHtml: dto.body_html!,
      metaDescription: dto.meta_description,
    });
    audit({
      targetType: 'page',
      targetId: page.id,
      payload: { slug: page.slug },
    });
    return new ApiResult(this.serializer.page(page), 'Page created.');
  }

  @Patch(':id')
  @AuditAction('pages.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpsertPageDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const page = await this.pages.findOrFail(id);
    const updated = await this.pages.update(page.id, {
      slug: dto.slug,
      title: dto.title,
      bodyHtml: dto.body_html,
      metaDescription: dto.meta_description,
    });
    audit({ targetType: 'page', targetId: page.id });
    return new ApiResult(this.serializer.page(updated), 'Page updated.');
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('pages.delete')
  async remove(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    const page = await this.pages.findOrFail(id);
    audit({
      targetType: 'page',
      targetId: page.id,
      payload: { slug: page.slug },
    });
    await this.pages.delete(page.id);
    return new ApiResult(null, 'Page deleted.');
  }

  @Post(':id/publish')
  @HttpCode(200)
  @AuditAction('pages.publish')
  async publish(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const page = await this.pages.findOrFail(id);
    const updated = await this.pages.setPublished(page.id, true);
    audit({ targetType: 'page', targetId: page.id });
    return new ApiResult(this.serializer.page(updated), 'Page published.');
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @AuditAction('pages.unpublish')
  async unpublish(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const page = await this.pages.findOrFail(id);
    const updated = await this.pages.setPublished(page.id, false);
    audit({ targetType: 'page', targetId: page.id });
    return new ApiResult(this.serializer.page(updated), 'Page unpublished.');
  }
}
