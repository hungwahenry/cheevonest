import { Controller, Get, Param, Query } from '@nestjs/common';
import { Paginated } from '../../../common/responses/paginated';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { EventSerializer } from '../../events/serializers/event.serializer';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { UserSerializer } from '../serializers/user.serializer';
import { PublicProfileService } from '../services/public-profile.service';
import { UsersService } from '../services/users.service';
import { PublicPageDto } from '../dto/public-page.dto';

@Controller('users')
export class PublicUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly profiles: PublicProfileService,
    private readonly userSerializer: UserSerializer,
    private readonly organisationSerializer: OrganisationSerializer,
    private readonly eventSerializer: EventSerializer,
  ) {}

  @Get(':userId')
  async show(
    @Param('userId') userId: string,
    @CurrentUser() viewer: User,
  ): Promise<unknown> {
    const user = await this.profiles.findVisibleOrFail(userId, viewer.id);

    return this.userSerializer.publicUser(
      user,
      await this.users.hasBlocked(viewer.id, 'user', user.id),
    );
  }

  @Get(':userId/interests')
  async interests(
    @Param('userId') userId: string,
    @CurrentUser() viewer: User,
  ): Promise<unknown[]> {
    const user = await this.profiles.findVisibleOrFail(userId, viewer.id);
    const interests = await this.profiles.interests(user.id);

    return interests.map((interest) => this.userSerializer.interest(interest));
  }

  @Get(':userId/organisations')
  async organisations(
    @Param('userId') userId: string,
    @Query() dto: PublicPageDto,
    @CurrentUser() viewer: User,
  ): Promise<Paginated<unknown>> {
    const user = await this.profiles.findVisibleOrFail(userId, viewer.id);
    const page = dto.page ?? 1;
    const perPage = 20;

    const result = await this.profiles.subscribedOrganisationsPage(
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

  @Get(':userId/attended-events')
  async attendedEvents(
    @Param('userId') userId: string,
    @Query() dto: PublicPageDto,
    @CurrentUser() viewer: User,
  ): Promise<Paginated<unknown>> {
    const user = await this.profiles.findVisibleOrFail(userId, viewer.id);
    const page = dto.page ?? 1;
    const perPage = 20;

    const result = await this.profiles.attendedEventsPage(
      user.id,
      page,
      perPage,
    );

    return new Paginated(
      result.items.map((event) => this.eventSerializer.searchItem(event)),
      page,
      perPage,
      result.total,
    );
  }
}
