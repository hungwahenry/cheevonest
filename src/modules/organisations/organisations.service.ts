import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchIndexerService } from '../search/services/search-indexer.service';
import { Prisma } from '../../generated/prisma/client';
import type {
  Organisation,
  OrganisationRole,
} from '../../generated/prisma/client';
import { OrganisationSuspendedException } from './exceptions/organisation-suspended.exception';

export const ORGANISATION_RESOURCE_INCLUDE = {
  category: true,
  socials: {
    include: { platform: true },
    orderBy: { socialPlatformId: Prisma.SortOrder.asc },
  },
} satisfies Prisma.OrganisationInclude;

export type OrganisationForResource = Prisma.OrganisationGetPayload<{
  include: typeof ORGANISATION_RESOURCE_INCLUDE;
}>;

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  /** Deindexes the org and its events from search, then cascade-deletes everything. */
  async purge(organisationId: string): Promise<void> {
    const events = await this.prisma.event.findMany({
      where: { organisationId },
      select: { id: true },
    });

    await this.searchIndexer.deindex('organisation', organisationId);
    for (const event of events) {
      await this.searchIndexer.deindex('event', event.id);
    }

    await this.prisma.organisation.delete({ where: { id: organisationId } });
  }

  async findOrFail(id: string): Promise<Organisation> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id },
    });

    if (!organisation) {
      throw new NotFoundException();
    }

    return organisation;
  }

  /** Gate every organiser-side mutation: a suspended org is frozen. */
  async ensureActive(organisationId: string): Promise<void> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { suspendedAt: true },
    });

    if (organisation?.suspendedAt != null) {
      throw new OrganisationSuspendedException();
    }
  }

  /** Pull a suspended org and its events out of search so they stop surfacing. */
  async deindexFromSearch(organisationId: string): Promise<void> {
    await this.searchIndexer.deindex('organisation', organisationId);
    const events = await this.prisma.event.findMany({
      where: { organisationId },
      select: { id: true },
    });
    for (const event of events) {
      await this.searchIndexer.deindex('event', event.id);
    }
  }

  /** Re-add an unsuspended org and its events to search. */
  async reindexInSearch(organisation: Organisation): Promise<void> {
    await this.searchIndexer.indexOrganisation(organisation);
    const events = await this.prisma.event.findMany({
      where: { organisationId: organisation.id },
    });
    for (const event of events) {
      await this.searchIndexer.indexEvent(event);
    }
  }

  async loadForResource(id: string): Promise<OrganisationForResource> {
    return this.prisma.organisation.findUniqueOrThrow({
      where: { id },
      include: ORGANISATION_RESOURCE_INCLUDE,
    });
  }

  async listForMember(
    userId: string,
  ): Promise<Array<{ organisation: OrganisationForResource; role: string }>> {
    const rows = await this.prisma.organisation.findMany({
      where: { members: { some: { userId } } },
      include: {
        ...ORGANISATION_RESOURCE_INCLUDE,
        members: { where: { userId }, select: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(({ members, ...organisation }) => ({
      organisation,
      role: members[0]?.role ?? 'member',
    }));
  }

  async activeCategories() {
    return this.prisma.organisationCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async activeSocialPlatforms() {
    return this.prisma.socialPlatform.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async roleOf(
    organisationId: string,
    userId: string,
  ): Promise<OrganisationRole | null> {
    const membership = await this.prisma.organisationMember.findUnique({
      where: { organisationId_userId: { organisationId, userId } },
      select: { role: true },
    });

    return membership?.role ?? null;
  }

  async hasMember(organisationId: string, userId: string): Promise<boolean> {
    return (await this.roleOf(organisationId, userId)) !== null;
  }
}
