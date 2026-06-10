import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { OrganisationsPolicy } from '../../../organisations/organisations.policy';
import { OrganisationsService } from '../../../organisations/organisations.service';
import { AddMemberDto } from '../dto/add-member.dto';
import { MemberSerializer } from '../serializers/member.serializer';
import { MembersService } from '../services/members.service';

@Controller('organizer/organisations/:organisationId/members')
export class MembersController {
  constructor(
    private readonly organisations: OrganisationsService,
    private readonly policy: OrganisationsPolicy,
    private readonly members: MembersService,
    private readonly serializer: MemberSerializer,
  ) {}

  @Get()
  async list(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: User,
  ): Promise<unknown[]> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertView(organisation.id, user.id);

    const members = await this.members.list(organisation.id);

    return members.map((member) => this.serializer.member(member));
  }

  @Post()
  @HttpCode(201)
  async add(
    @Param('organisationId') organisationId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertManageMembers(organisation.id, user.id);

    const member = await this.members.addByEmail(organisation.id, dto.email);

    return new ApiResult(this.serializer.member(member), 'Member added.');
  }

  @Delete(':userId')
  async remove(
    @Param('organisationId') organisationId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertManageMembers(organisation.id, user.id);

    await this.members.removeByUserId(organisation.id, userId);

    return new ApiResult(null, 'Member removed.');
  }
}
