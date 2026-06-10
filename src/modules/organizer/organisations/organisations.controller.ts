import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import { PrismaService } from '../../../database/prisma.service';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { OrganisationsPolicy } from '../../organisations/organisations.policy';
import {
  ORGANISATION_RESOURCE_INCLUDE,
  OrganisationsService,
} from '../../organisations/organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { OrganisationManagerService } from './organisation-manager.service';

@Controller('organizer/organisations')
export class OrganisationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: OrganisationManagerService,
    private readonly organisations: OrganisationsService,
    private readonly policy: OrganisationsPolicy,
    private readonly serializer: OrganisationSerializer,
  ) {}

  @Get()
  async list(@CurrentUser() user: User): Promise<unknown[]> {
    const organisations = await this.prisma.organisation.findMany({
      where: { members: { some: { userId: user.id } } },
      include: ORGANISATION_RESOURCE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return organisations.map((organisation) =>
      this.serializer.organisation(organisation),
    );
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateOrganisationDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.manager.create(user, dto);

    return new ApiResult(
      this.serializer.organisation(organisation),
      'Organisation created.',
    );
  }

  @Put(':organisationId')
  async replace(
    @Param('organisationId') organisationId: string,
    @Body() dto: UpdateOrganisationDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    return this.update(organisationId, dto, user);
  }

  @Patch(':organisationId')
  async update(
    @Param('organisationId') organisationId: string,
    @Body() dto: UpdateOrganisationDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertManage(organisation.id, user.id);

    const updated = await this.manager.update(organisation, dto);

    return new ApiResult(
      this.serializer.organisation(updated),
      'Organisation updated.',
    );
  }
}
