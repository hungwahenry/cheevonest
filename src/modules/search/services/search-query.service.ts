import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { countByType, searchByType } from '../../../generated/prisma/sql';
import { UsersService } from '../../users/services/users.service';
import { SearchableType } from './search-indexer.service';

export interface SearchPage<T> {
  items: T[];
  total: number;
}

const HYDRATE_EVENT_INCLUDE = {
  organisation: true,
} satisfies Prisma.EventInclude;

const HYDRATE_ORGANISATION_INCLUDE = {
  category: true,
} satisfies Prisma.OrganisationInclude;

export type SearchEventHit = Prisma.EventGetPayload<{
  include: typeof HYDRATE_EVENT_INCLUDE;
}>;
export type SearchOrganisationHit = Prisma.OrganisationGetPayload<{
  include: typeof HYDRATE_ORGANISATION_INCLUDE;
}>;
export type SearchUserHit = Prisma.UserGetPayload<{
  include: { profile: true };
}>;

@Injectable()
export class SearchQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /** "ade lag" → "ade:* & lag:*" — prefix-tolerant tsquery from raw input. */
  tsquery(query: string): string {
    return query
      .trim()
      .split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((term) => term !== '')
      .map((term) => `${term}:*`)
      .join(' & ');
  }

  async topEvents(
    query: string,
    viewerId: string,
    limit: number,
  ): Promise<SearchEventHit[]> {
    const ids = await this.matchIds(query, 'event', limit, 0);

    if (ids.length === 0) {
      return [];
    }

    const blockedOrgIds = await this.users.blockedOrganisationIds(viewerId);
    const rows = await this.prisma.event.findMany({
      where: {
        id: { in: ids },
        ...(blockedOrgIds.length > 0
          ? { organisationId: { notIn: blockedOrgIds } }
          : {}),
      },
      include: HYDRATE_EVENT_INCLUDE,
    });

    return this.inOrder(ids, rows);
  }

  async topOrganisations(
    query: string,
    viewerId: string,
    limit: number,
  ): Promise<SearchOrganisationHit[]> {
    const ids = await this.matchIds(query, 'organisation', limit, 0);

    if (ids.length === 0) {
      return [];
    }

    const blockedOrgIds = await this.users.blockedOrganisationIds(viewerId);
    const rows = await this.prisma.organisation.findMany({
      where: {
        id: { in: ids },
        ...(blockedOrgIds.length > 0
          ? { id: { in: ids, notIn: blockedOrgIds } }
          : {}),
      },
      include: HYDRATE_ORGANISATION_INCLUDE,
    });

    return this.inOrder(ids, rows);
  }

  async topUsers(
    query: string,
    viewerId: string,
    limit: number,
  ): Promise<SearchUserHit[]> {
    const ids = await this.matchIds(query, 'user', limit, 0);

    if (ids.length === 0) {
      return [];
    }

    const blockedUserIds = await this.users.mutuallyBlockedUserIds(viewerId);
    const rows = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        ...(blockedUserIds.length > 0
          ? { id: { in: ids, notIn: blockedUserIds } }
          : {}),
      },
      include: { profile: true },
    });

    return this.inOrder(ids, rows);
  }

  async pageIds(
    query: string,
    type: SearchableType,
    page: number,
    perPage: number,
  ): Promise<SearchPage<string>> {
    const tsquery = this.tsquery(query);

    if (tsquery === '') {
      return { items: [], total: 0 };
    }

    const [rows, counts] = await Promise.all([
      this.prisma.$queryRawTyped(
        searchByType(tsquery, type, perPage, (page - 1) * perPage),
      ),
      this.prisma.$queryRawTyped(countByType(tsquery, type)),
    ]);

    return {
      items: rows.map((row) => row.searchable_id),
      total: counts[0]?.total ?? 0,
    };
  }

  private async matchIds(
    query: string,
    type: SearchableType,
    limit: number,
    offset: number,
  ): Promise<string[]> {
    const tsquery = this.tsquery(query);

    if (tsquery === '') {
      return [];
    }

    const rows = await this.prisma.$queryRawTyped(
      searchByType(tsquery, type, limit, offset),
    );

    return rows.map((row) => row.searchable_id);
  }

  private inOrder<T extends { id: string }>(ids: string[], rows: T[]): T[] {
    const byId = new Map(rows.map((row) => [row.id, row]));

    return ids
      .map((id) => byId.get(id))
      .filter((row): row is T => row !== undefined);
  }
}
