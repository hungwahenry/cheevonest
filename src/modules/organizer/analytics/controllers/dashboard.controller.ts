import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { OrganisationsPolicy } from '../../../organisations/organisations.policy';
import { OrganisationsService } from '../../../organisations/organisations.service';
import { DashboardService } from '../services/dashboard.service';

class DashboardQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '12mo'])
  range?: string;
}

@Controller('organizer/organisations/:organisationId/dashboard')
export class DashboardController {
  constructor(
    private readonly organisations: OrganisationsService,
    private readonly policy: OrganisationsPolicy,
    private readonly dashboard: DashboardService,
  ) {}

  @Get()
  async show(
    @Param('organisationId') organisationId: string,
    @Query() dto: DashboardQueryDto,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.ensureView(organisation.id, user.id);

    return this.dashboard.summary(organisation, dto.range ?? '30d');
  }
}
