import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Paginated } from '../../../common/responses/paginated';
import { toNumber } from '../../../common/validation/transforms';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { EventSerializer } from '../../events/serializers/event.serializer';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { UserSerializer } from '../serializers/user.serializer';
import { UsersService } from '../services/users.service';

class PublicPageDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
}

@Controller('users')
export class PublicUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly userSerializer: UserSerializer,
    private readonly organisationSerializer: OrganisationSerializer,
    private readonly eventSerializer: EventSerializer,
  ) {}

  @Get(':userId')
  async show(
    @Param('userId') userId: string,
    @CurrentUser() viewer: User,
  ): Promise<unknown> {
    const user = await this.findCompletedUser(userId);

    return this.userSerializer.publicUser(
      user,
      await this.users.hasBlocked(viewer.id, 'user', user.id),
    );
  }

  @Get(':userId/interests')
  async interests(@Param('userId') userId: string): Promise<unknown[]> {
    const user = await this.findCompletedUser(userId);

    const pivot = await this.prisma.interestUser.findMany({
      where: { userId: user.id },
      include: { interest: true },
      orderBy: { interest: { name: 'asc' } },
    });

    return pivot.map(({ interest }) => this.userSerializer.interest(interest));
  }

  @Get(':userId/organisations')
  async organisations(
    @Param('userId') userId: string,
    @Query() dto: PublicPageDto,
  ): Promise<Paginated<unknown>> {
    const user = await this.findCompletedUser(userId);
    const page = dto.page ?? 1;
    const perPage = 20;

    const where = { subscriptions: { some: { userId: user.id } } };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.organisation.count({ where }),
      this.prisma.organisation.findMany({
        where,
        include: { category: true },
        orderBy: { name: Prisma.SortOrder.asc },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return new Paginated(
      rows.map((organisation) =>
        this.organisationSerializer.summary(organisation),
      ),
      page,
      perPage,
      total,
    );
  }

  @Get(':userId/attended-events')
  async attendedEvents(
    @Param('userId') userId: string,
    @Query() dto: PublicPageDto,
  ): Promise<Paginated<unknown>> {
    const user = await this.findCompletedUser(userId);
    const page = dto.page ?? 1;
    const perPage = 20;

    const where: Prisma.EventWhereInput = {
      status: 'past',
      rsvps: { some: { userId: user.id } },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: { organisation: true },
        orderBy: { endsAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return new Paginated(
      rows.map((event) => this.eventSerializer.searchItem(event)),
      page,
      perPage,
      total,
    );
  }

  private async findCompletedUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile || user.profile.completedAt === null) {
      throw new NotFoundException();
    }

    return user;
  }
}
