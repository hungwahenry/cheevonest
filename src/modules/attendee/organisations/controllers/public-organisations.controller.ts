import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Paginated } from '../../../../common/responses/paginated';
import { PrismaService } from '../../../../database/prisma.service';
import type { Organisation, User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventSerializer } from '../../../events/serializers/event.serializer';
import { OrganisationSerializer } from '../../../organisations/organisation.serializer';
import { ORGANISATION_RESOURCE_INCLUDE } from '../../../organisations/organisations.service';
import { UserSerializer } from '../../../users/serializers/user.serializer';
import { UsersService } from '../../../users/services/users.service';
import { PageQueryDto } from '../dto/page-query.dto';

@Controller('attendee/orgs')
export class PublicOrganisationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly organisationSerializer: OrganisationSerializer,
    private readonly eventSerializer: EventSerializer,
    private readonly userSerializer: UserSerializer,
  ) {}

  @Get(':slug')
  async show(
    @Param('slug') slug: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { slug },
      include: ORGANISATION_RESOURCE_INCLUDE,
    });

    if (!organisation) {
      throw new NotFoundException();
    }

    const [subscription, isBlocked] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: {
          userId_organisationId: {
            userId: user.id,
            organisationId: organisation.id,
          },
        },
        select: { userId: true },
      }),
      this.users.hasBlocked(user.id, 'organisation', organisation.id),
    ]);

    return this.organisationSerializer.publicOrganisation(organisation, {
      isSubscribed: subscription !== null,
      isBlocked,
    });
  }

  @Get(':slug/upcoming-events')
  async upcomingEvents(
    @Param('slug') slug: string,
    @Query() dto: PageQueryDto,
  ): Promise<Paginated<unknown>> {
    return this.eventsPage(slug, 'published', dto.page ?? 1);
  }

  @Get(':slug/past-events')
  async pastEvents(
    @Param('slug') slug: string,
    @Query() dto: PageQueryDto,
  ): Promise<Paginated<unknown>> {
    return this.eventsPage(slug, 'past', dto.page ?? 1);
  }

  @Get(':slug/subscribers')
  async subscribers(@Param('slug') slug: string): Promise<unknown> {
    const organisation = await this.findBySlug(slug);

    const sample = await this.prisma.subscription.findMany({
      where: { organisationId: organisation.id },
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      count: organisation.subscribersCount,
      sample: sample.map((subscription) =>
        this.userSerializer.searchItem(subscription.user),
      ),
    };
  }

  private async eventsPage(
    slug: string,
    status: 'published' | 'past',
    page: number,
  ): Promise<Paginated<unknown>> {
    const organisation = await this.findBySlug(slug);
    const perPage = 20;

    const where = { organisationId: organisation.id, status } as const;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: { organisation: true },
        orderBy:
          status === 'published' ? { startsAt: 'asc' } : { endsAt: 'desc' },
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

  private async findBySlug(slug: string): Promise<Organisation> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { slug },
    });

    if (!organisation) {
      throw new NotFoundException();
    }

    return organisation;
  }
}
