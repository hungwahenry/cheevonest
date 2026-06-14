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
import { UpsertInterestDto } from '../dto/catalog.dto';
import { CatalogSerializer } from '../serializers/catalog.serializer';
import { CatalogService } from '../services/catalog.service';

@Roles('admin')
@Controller('admin/interests')
export class AdminInterestsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly serializer: CatalogSerializer,
  ) {}

  @Get()
  async list(): Promise<unknown[]> {
    return (await this.catalog.interests()).map((i) =>
      this.serializer.interest(i),
    );
  }

  @Post()
  @HttpCode(201)
  @AuditAction('interests.create')
  async create(
    @Body() dto: UpsertInterestDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const created = await this.catalog.createInterest({
      slug: dto.slug!,
      name: dto.name!,
      sortOrder: dto.sort_order,
    });
    audit({ targetType: 'interest', targetId: String(created.id) });
    return new ApiResult(
      this.serializer.interest(created),
      'Interest created.',
    );
  }

  @Patch(':id')
  @AuditAction('interests.update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertInterestDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const updated = await this.catalog.updateInterest(id, {
      slug: dto.slug,
      name: dto.name,
      sortOrder: dto.sort_order,
      isActive: dto.is_active,
    });
    audit({ targetType: 'interest', targetId: String(id) });
    return new ApiResult(
      this.serializer.interest(updated),
      'Interest updated.',
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('interests.delete')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    await this.catalog.deleteInterest(id);
    audit({ targetType: 'interest', targetId: String(id) });
    return new ApiResult(null, 'Interest deleted.');
  }
}
