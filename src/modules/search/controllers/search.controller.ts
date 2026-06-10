import { Controller, Get, Param, Query } from '@nestjs/common';
import { Paginated } from '../../../common/responses/paginated';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { EventSerializer } from '../../events/serializers/event.serializer';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { SearchDto } from '../dto/search.dto';
import { UnknownSearchTypeException } from '../exceptions/unknown-search-type.exception';
import { SearchableType } from '../services/search-indexer.service';
import { SearchQueryService } from '../services/search-query.service';

const SEARCH_TYPES: SearchableType[] = ['event', 'organisation', 'user'];

@Controller('search')
export class SearchController {
  constructor(
    private readonly search: SearchQueryService,
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

    const hydrated = await this.search.hydratePage(searchType, ids, user.id);

    const items =
      hydrated.type === 'event'
        ? hydrated.rows.map((event) => this.eventSerializer.searchItem(event))
        : hydrated.type === 'organisation'
          ? hydrated.rows.map((organisation) =>
              this.organisationSerializer.summary(organisation),
            )
          : hydrated.rows.map((hit) => this.userSerializer.searchItem(hit));

    return new Paginated(items, page, perPage, total);
  }
}
