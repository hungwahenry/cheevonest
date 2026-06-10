import { Injectable } from '@nestjs/common';
import { Paginated } from '../../../common/responses/paginated';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { User } from '../../../generated/prisma/client';
import { feedCount, feedPage } from '../../../generated/prisma/sql';
import { EventSerializer } from '../../events/serializers/event.serializer';
import { SystemConfigService } from '../../platform/system-config/system-config.service';

const FEED_HYDRATE_INCLUDE = {
  organisation: true,
  interests: {
    include: { interest: true },
    orderBy: { interest: { sortOrder: Prisma.SortOrder.asc } },
  },
} satisfies Prisma.EventInclude;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly serializer: EventSerializer,
  ) {}

  async feed(
    user: User,
    page: number,
    perPage: number,
  ): Promise<Paginated<unknown>> {
    const [
      wInterest,
      wSubscribed,
      wGeo,
      wTime,
      wRecency,
      tb24,
      tb7,
      tb30,
      rb7,
      rb30,
      geoScale,
    ] = await Promise.all([
      this.systemConfig.decimal('feed.weight_interest', 3.0),
      this.systemConfig.decimal('feed.weight_subscribed', 4.0),
      this.systemConfig.decimal('feed.weight_geo', 2.0),
      this.systemConfig.decimal('feed.weight_time', 2.0),
      this.systemConfig.decimal('feed.weight_recency', 0.5),
      this.systemConfig.decimal('feed.time_bonus_24h', 1.0),
      this.systemConfig.decimal('feed.time_bonus_7d', 0.7),
      this.systemConfig.decimal('feed.time_bonus_30d', 0.4),
      this.systemConfig.decimal('feed.recency_bonus_7d', 1.0),
      this.systemConfig.decimal('feed.recency_bonus_30d', 0.4),
      this.systemConfig.decimal('feed.geo_distance_scale_km', 50.0),
    ]);

    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
      select: { latitude: true, longitude: true, city: true },
    });

    const hasCoords =
      profile?.latitude != null && profile?.longitude != null ? 1 : 0;
    const hasCity = hasCoords === 0 && profile?.city != null ? 1 : 0;

    const [rows, counts] = await Promise.all([
      this.prisma.$queryRawTyped(
        feedPage(
          user.id,
          hasCoords,
          hasCoords === 1 ? Number(profile?.latitude) : 0,
          hasCoords === 1 ? Number(profile?.longitude) : 0,
          hasCity,
          profile?.city ?? '',
          wInterest,
          wSubscribed,
          wGeo,
          wTime,
          wRecency,
          tb24,
          tb7,
          tb30,
          rb7,
          rb30,
          geoScale,
          perPage,
          (page - 1) * perPage,
        ),
      ),
      this.prisma.$queryRawTyped(feedCount(user.id)),
    ]);

    const ids = rows.map((row) => row.id);
    const events = await this.prisma.event.findMany({
      where: { id: { in: ids } },
      include: FEED_HYDRATE_INCLUDE,
    });
    const byId = new Map(events.map((event) => [event.id, event]));

    const items = rows.flatMap((row) => {
      const event = byId.get(row.id);

      if (!event) {
        return [];
      }

      return [
        this.serializer.feedItem(event, {
          interestOverlap: row.interest_overlap ?? 0,
          isSubscribed: (row.is_subscribed ?? 0) === 1,
        }),
      ];
    });

    return new Paginated(items, page, perPage, counts[0]?.total ?? 0);
  }
}
