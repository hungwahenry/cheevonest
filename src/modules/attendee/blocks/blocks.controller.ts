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
import { IsIn, IsString, Length } from 'class-validator';
import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';
import { PrismaService } from '../../../database/prisma.service';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { PageQueryDto } from '../organisations/dto/page-query.dto';
import { BLOCKABLE_TYPES, BlocksService } from './blocks.service';

class CreateBlockDto {
  @IsString()
  @IsIn(BLOCKABLE_TYPES)
  target_type!: string;

  @IsString()
  @Length(26, 26)
  target_id!: string;
}

@Controller('attendee/blocks')
export class BlocksController {
  constructor(
    private readonly prisma: PrismaService,
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
    const where = {
      blockerUserId: user.id,
      blockableType: 'organisation',
    } as const;

    const [total, blocks] = await this.prisma.$transaction([
      this.prisma.block.count({ where }),
      this.prisma.block.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const ids = blocks.map((block) => block.blockableId);
    const organisations = await this.prisma.organisation.findMany({
      where: { id: { in: ids } },
      include: { category: true },
    });
    const byId = new Map(organisations.map((org) => [org.id, org]));

    return new Paginated(
      ids.flatMap((id) => {
        const organisation = byId.get(id);

        return organisation
          ? [this.organisationSerializer.summary(organisation)]
          : [];
      }),
      page,
      perPage,
      total,
    );
  }

  @Get('users')
  async users(
    @Query() dto: PageQueryDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = 20;
    const where = { blockerUserId: user.id, blockableType: 'user' } as const;

    const [total, blocks] = await this.prisma.$transaction([
      this.prisma.block.count({ where }),
      this.prisma.block.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const ids = blocks.map((block) => block.blockableId);
    const blockedUsers = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      include: { profile: true },
    });
    const byId = new Map(blockedUsers.map((blocked) => [blocked.id, blocked]));

    return new Paginated(
      ids.flatMap((id) => {
        const blocked = byId.get(id);

        return blocked ? [this.userSerializer.searchItem(blocked)] : [];
      }),
      page,
      perPage,
      total,
    );
  }
}
