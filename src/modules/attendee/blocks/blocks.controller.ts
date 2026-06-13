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
import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { PageQueryDto } from '../organisations/dto/page-query.dto';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/blocks.dto';

@Controller('attendee/blocks')
export class BlocksController {
  constructor(
    private readonly blocks: BlocksService,
    private readonly organisationSerializer: OrganisationSerializer,
    private readonly userSerializer: UserSerializer,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateBlockDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    await this.blocks.block(user, dto.target_type, dto.target_id);

    return new ApiResult(null, 'Blocked.');
  }

  @Delete(':type/:id')
  @HttpCode(200)
  async remove(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    await this.blocks.unblock(user, type, id);

    return new ApiResult(null, 'Unblocked.');
  }

  @Get('organisations')
  async organisations(
    @Query() dto: PageQueryDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = 20;

    const result = await this.blocks.blockedOrganisationsPage(
      user.id,
      page,
      perPage,
    );

    return new Paginated(
      result.items.map((organisation) =>
        this.organisationSerializer.summary(organisation),
      ),
      page,
      perPage,
      result.total,
    );
  }

  @Get('users')
  async users(
    @Query() dto: PageQueryDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = 20;

    const result = await this.blocks.blockedUsersPage(user.id, page, perPage);

    return new Paginated(
      result.items.map((blocked) => this.userSerializer.searchItem(blocked)),
      page,
      perPage,
      result.total,
    );
  }
}
