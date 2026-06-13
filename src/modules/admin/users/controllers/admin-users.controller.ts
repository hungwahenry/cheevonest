import {
  Body,
  Controller,
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
import { ListUsersDto, SuspendUserDto } from '../dto/admin-users.dto';
import { AdminUserSerializer } from '../serializers/admin-user.serializer';
import { AdminUsersService } from '../services/admin-users.service';
import { UserModerationService } from '../services/user-moderation.service';

@Roles('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly moderation: UserModerationService,
    private readonly serializer: AdminUserSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListUsersDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.users.page({
      page,
      perPage,
      search: dto.q,
      suspended: dto.suspended,
      role: dto.role,
    });

    return new Paginated(
      result.items.map((user) => this.serializer.row(user)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.detail(await this.users.detail(id));
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @AuditAction('users.suspend')
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const user = await this.users.findOrFail(id);
    const updated = await this.moderation.suspend(user, dto.reason);

    audit({ targetType: 'user', targetId: user.id, reason: dto.reason });

    return new ApiResult(
      this.serializer.row({ ...updated, profile: null }),
      'User suspended.',
    );
  }

  @Post(':id/unsuspend')
  @HttpCode(200)
  @AuditAction('users.unsuspend')
  async unsuspend(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const user = await this.users.findOrFail(id);
    const updated = await this.moderation.unsuspend(user);

    audit({ targetType: 'user', targetId: user.id });

    return new ApiResult(
      this.serializer.row({ ...updated, profile: null }),
      'User unsuspended.',
    );
  }

  @Post(':id/revoke-sessions')
  @HttpCode(200)
  @AuditAction('users.revoke_sessions')
  async revokeSessions(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const user = await this.users.findOrFail(id);
    const count = await this.moderation.revokeSessions(user);

    audit({
      targetType: 'user',
      targetId: user.id,
      payload: { revoked: count },
    });

    return new ApiResult({ revoked: count }, 'Sessions revoked.');
  }
}
