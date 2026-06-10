import { Controller, Get, Param, Query } from '@nestjs/common';
import { Paginated } from '../../../common/responses/paginated';
import { PrismaService } from '../../../database/prisma.service';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { EventSerializer } from '../../events/serializers/event.serializer';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { UsersService } from '../../users/services/users.service';
import { SearchDto } from '../dto/search.dto';
import { UnknownSearchTypeException } from '../exceptions/unknown-search-type.exception';
import { SearchableType } from '../services/search-indexer.service';
import { SearchQueryService } from '../services/search-query.service';

const SEARCH_TYPES: SearchableType[] = ['event', 'organisation', 'user'];

@Controller('search')
export class SearchController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchQueryService,
    private readonly users: UsersService,
    private readonly systemConfig: SystemConfigService,
    private readonly eventSerializer: EventSerializer,
    private readonly organisationSerializer: OrganisationSerializer,
    private readonly userSerializer: UserSerializer,
  ) {}

  @Get()
  async all(
    @Query() dto: SearchDto,
    @CurrentUser() user: User,
  ): Promise<Record<string, unknown>> {
    const perGroup = await this.systemConfig.int(
      'search.results_per_group_limit',
      5,
    );

    const [events, organisations, userHits] = await Promise.all([
      this.search.topEvents(dto.q, user.id, perGroup),
      this.search.topOrganisations(dto.q, user.id, perGroup),
      this.search.topUsers(dto.q, user.id, perGroup),
    ]);

    return {
      events: events.map((event) => this.eventSerializer.searchItem(event)),
      organisations: organisations.map((organisation) =>
        this.organisationSerializer.summary(organisation),
      ),
      users: userHits.map((hit) => this.userSerializer.searchItem(hit)),
    };
  }

  @Get(':type')
  async byType(
    @Param('type') type: string,
    @Query() dto: SearchDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    if (!SEARCH_TYPES.includes(type as SearchableType)) {
      throw new UnknownSearchTypeException(type);
    }

    const searchType = type as SearchableType;
    const page = dto.page ?? 1;
    const perPage = await this.systemConfig.int('search.per_page_default', 20);

    const { items: ids, total } = await this.search.pageIds(
      dto.q,
      searchType,
      page,
      perPage,
    );

    const items = await this.hydratePage(searchType, ids, user.id);

    return new Paginated(items, page, perPage, total);
  }

  private async hydratePage(
    type: SearchableType,
    ids: string[],
    viewerId: string,
  ): Promise<unknown[]> {
    if (ids.length === 0) {
      return [];
    }

    if (type === 'event') {
      const blocked = await this.users.blockedOrganisationIds(viewerId);
      const rows = await this.prisma.event.findMany({
        where: {
          id: { in: ids },
          ...(blocked.length > 0 ? { organisationId: { notIn: blocked } } : {}),
        },
        include: { organisation: true },
      });

      return this.ordered(ids, rows).map((event) =>
        this.eventSerializer.searchItem(event),
      );
    }

    if (type === 'organisation') {
      const blocked = await this.users.blockedOrganisationIds(viewerId);
      const rows = await this.prisma.organisation.findMany({
        where: { id: { in: ids.filter((id) => !blocked.includes(id)) } },
        include: { category: true },
      });

      return this.ordered(ids, rows).map((organisation) =>
        this.organisationSerializer.summary(organisation),
      );
    }

    const blockedUsers = await this.users.mutuallyBlockedUserIds(viewerId);
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids.filter((id) => !blockedUsers.includes(id)) } },
      include: { profile: true },
    });

    return this.ordered(ids, rows).map((hit) =>
      this.userSerializer.searchItem(hit),
    );
  }

  private ordered<T extends { id: string }>(ids: string[], rows: T[]): T[] {
    const byId = new Map(rows.map((row) => [row.id, row]));

    return ids
      .map((id) => byId.get(id))
      .filter((row): row is T => row !== undefined);
  }
}
