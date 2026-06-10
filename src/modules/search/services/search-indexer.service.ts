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
