import { Controller, Get, Param, Query } from '@nestjs/common';
import { Paginated } from '../../../../common/responses/paginated';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventSerializer } from '../../../events/serializers/event.serializer';
import { OrganisationSerializer } from '../../../organisations/organisation.serializer';
import { UserSerializer } from '../../../users/serializers/user.serializer';
import { PageQueryDto } from '../dto/page-query.dto';
import { PublicOrganisationsService } from '../services/public-organisations.service';

@Controller('attendee/orgs')
export class PublicOrganisationsController {
  constructor(
    private readonly publicOrganisations: PublicOrganisationsService,
    private readonly organisationSerializer: OrganisationSerializer,
    private readonly eventSerializer: EventSerializer,
    private readonly userSerializer: UserSerializer,
  ) {}

  @Get(':slug')
  async show(
    @Param('slug') slug: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const { organisation, flags } =
      await this.publicOrganisations.showForViewer(slug, user);

    return this.organisationSerializer.publicOrganisation(organisation, flags);
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
    const result = await this.publicOrganisations.subscribersSample(slug);

    return {
      count: result.count,
      sample: result.sample.map((user) => this.userSerializer.searchItem(user)),
    };
  }

  private async eventsPage(
    slug: string,
    status: 'published' | 'past',
    page: number,
  ): Promise<Paginated<unknown>> {
    const result = await this.publicOrganisations.eventsPage(
      slug,
      status,
      page,
    );

    return new Paginated(
      result.items.map((event) => this.eventSerializer.searchItem(event)),
      page,
      result.perPage,
      result.total,
    );
  }
}
