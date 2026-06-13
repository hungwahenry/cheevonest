import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import {
  ChangeOwnerDto,
  DeleteOrganisationDto,
  ListOrganisationsDto,
  SuspendOrganisationDto,
} from '../dto/admin-organisations.dto';
import { AdminOrganisationSerializer } from '../serializers/admin-organisation.serializer';
import { AdminOrganisationsService } from '../services/admin-organisations.service';
import { OrganisationModerationService } from '../services/organisation-moderation.service';

@Roles('admin')
@Controller('admin/organisations')
export class AdminOrganisationsController {
  constructor(
    private readonly organisations: AdminOrganisationsService,
    private readonly moderation: OrganisationModerationService,
    private readonly serializer: AdminOrganisationSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListOrganisationsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.organisations.page({
      page,
      perPage,
      search: dto.q,
      suspended: dto.suspended,
    });

    return new Paginated(
      result.items.map((organisation) => this.serializer.row(organisation)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.detail(await this.organisations.detail(id));
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @AuditAction('organisations.suspend')
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendOrganisationDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.moderation.findOrFail(id);
    const updated = await this.moderation.suspend(organisation, dto.reason);

    audit({
      targetType: 'organisation',
      targetId: organisation.id,
      reason: dto.reason,
    });

    return new ApiResult(
      this.serializer.row({ ...updated, category: null }),
      'Organisation suspended.',
    );
  }

  @Post(':id/unsuspend')
  @HttpCode(200)
  @AuditAction('organisations.unsuspend')
  async unsuspend(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.moderation.findOrFail(id);
    const updated = await this.moderation.unsuspend(organisation);

    audit({ targetType: 'organisation', targetId: organisation.id });

    return new ApiResult(
      this.serializer.row({ ...updated, category: null }),
      'Organisation unsuspended.',
    );
  }

  @Post(':id/change-owner')
  @HttpCode(200)
  @AuditAction('organisations.change_owner')
  async changeOwner(
    @Param('id') id: string,
    @Body() dto: ChangeOwnerDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.moderation.findOrFail(id);
    const updated = await this.moderation.changeOwner(
      organisation,
      dto.user_id,
    );

    audit({
      targetType: 'organisation',
      targetId: organisation.id,
      payload: { new_owner_user_id: dto.user_id },
      reason: dto.reason ?? null,
    });

    return new ApiResult(
      this.serializer.row({ ...updated, category: null }),
      'Owner changed.',
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('organisations.delete')
  async remove(
    @Param('id') id: string,
    @Body() dto: DeleteOrganisationDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<null>> {
    const organisation = await this.moderation.findOrFail(id);

    audit({
      targetType: 'organisation',
      targetId: organisation.id,
      payload: { name: organisation.name, slug: organisation.slug },
      reason: dto.reason,
    });

    await this.moderation.delete(organisation);

    return new ApiResult(null, 'Organisation deleted.');
  }
}
