import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { upsertSearchDocument } from '../../../generated/prisma/sql';
import type { Event, Organisation } from '../../../generated/prisma/client';

export type SearchableType = 'event' | 'organisation' | 'user';

interface SearchDocument {
  weightA: string;
  weightB: string;
  weightC: string;
}

@Injectable()
export class SearchIndexerService {
  constructor(private readonly prisma: PrismaService) {}

  async indexEvent(event: Event): Promise<void> {
    if (event.status !== 'published' && event.status !== 'past') {
      return this.deindex('event', event.id);
    }

    return this.upsert('event', event.id, {
      weightA: event.title ?? '',
      weightB: event.description ?? '',
      weightC: `${event.venueName ?? ''} ${event.city ?? ''}`.trim(),
    });
  }

  async indexOrganisation(organisation: Organisation): Promise<void> {
    return this.upsert('organisation', organisation.id, {
      weightA: `${organisation.name} ${organisation.slug}`.trim(),
      weightB: organisation.about ?? '',
      weightC: organisation.city ?? '',
    });
  }

  async indexUser(userId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile || profile.completedAt === null) {
      return this.deindex('user', userId);
    }

    const displayName =
      `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();

    return this.upsert('user', userId, {
      weightA: `${profile.username ?? ''} ${displayName}`.trim(),
      weightB: '',
      weightC: profile.city ?? '',
    });
  }

  /** Rebuilds the entire search index — published/past events, orgs, onboarded users. */
  async reindexAll(): Promise<{
    events: number;
    organisations: number;
    users: number;
  }> {
    const [events, organisations, users] = await Promise.all([
      this.prisma.event.findMany({
        where: { status: { in: ['published', 'past'] } },
      }),
      this.prisma.organisation.findMany(),
      this.prisma.user.findMany({
        where: { profile: { completedAt: { not: null } } },
        select: { id: true },
      }),
    ]);

    for (const event of events) {
      await this.indexEvent(event);
    }
    for (const organisation of organisations) {
      await this.indexOrganisation(organisation);
    }
    for (const user of users) {
      await this.indexUser(user.id);
    }

    return {
      events: events.length,
      organisations: organisations.length,
      users: users.length,
    };
  }

  async health(): Promise<Record<string, number>> {
    const byType = await this.prisma.searchIndex.groupBy({
      by: ['searchableType'],
      orderBy: { searchableType: 'asc' },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {
      event: 0,
      organisation: 0,
      user: 0,
    };
    for (const row of byType) {
      counts[row.searchableType] = row._count._all;
    }
    counts.total = byType.reduce((sum, row) => sum + row._count._all, 0);

    return counts;
  }

  async deindex(type: SearchableType, id: string): Promise<void> {
    await this.prisma.searchIndex.deleteMany({
      where: { searchableType: type, searchableId: id },
    });
  }

  private async upsert(
    type: SearchableType,
    id: string,
    document: SearchDocument,
  ): Promise<void> {
    await this.prisma.$queryRawTyped(
      upsertSearchDocument(
        type,
        id,
        document.weightA,
        document.weightB,
        document.weightC,
      ),
    );
  }
}
