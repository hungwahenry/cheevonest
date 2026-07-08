import { Injectable } from '@nestjs/common';
import { Paginated } from '../../common/responses/paginated';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { EventSerializer } from '../events/serializers/event.serializer';

const PUBLIC_FEED_INCLUDE = {
  organisation: true,
  interests: {
    include: { interest: true },
    orderBy: { interest: { sortOrder: Prisma.SortOrder.asc } },
  },
} satisfies Prisma.EventInclude;

@Injectable()
export class PublicFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: EventSerializer,
  ) {}

  /** Anonymous discovery: upcoming published events, soonest first. Mirrors the
   *  attendee feed's card shape without the per-user personalisation scoring. */
  async feed(page: number, perPage: number): Promise<Paginated<unknown>> {
    const where: Prisma.EventWhereInput = {
      status: 'published',
      endsAt: { gt: new Date() },
      organisation: { suspendedAt: null },
    };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: PUBLIC_FEED_INCLUDE,
        orderBy: [
          { startsAt: Prisma.SortOrder.asc },
          { id: Prisma.SortOrder.asc },
        ],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.event.count({ where }),
    ]);

    const items = events.map((event) =>
      this.serializer.feedItem(event, {
        interestOverlap: 0,
        isSubscribed: false,
      }),
    );

    return new Paginated(items, page, perPage, total);
  }
}
