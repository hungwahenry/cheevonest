import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { UserRole } from '../../../../generated/prisma/client';

export interface SegmentDefinition {
  userIds?: string[];
  roles?: UserRole[];
  interestIds?: number[];
  cities?: string[];
  hasOrdered?: boolean;
  activeSince?: string;
  inactiveSince?: string;
  hasUpcomingRsvp?: boolean;
}

@Injectable()
export class AudienceSegmentService {
  constructor(private readonly prisma: PrismaService) {}

  where(
    segment: SegmentDefinition,
    options: { requireMarketingConsent: boolean },
  ): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [{ suspendedAt: null }];

    if (options.requireMarketingConsent) {
      and.push({ profile: { marketingOptIn: true } });
    }

    if (segment.userIds?.length) {
      and.push({ id: { in: segment.userIds } });
    }

    if (segment.roles?.length) {
      and.push({ role: { in: segment.roles } });
    }

    if (segment.cities?.length) {
      and.push({ profile: { city: { in: segment.cities } } });
    }

    if (segment.interestIds?.length) {
      and.push({
        interests: { some: { interestId: { in: segment.interestIds } } },
      });
    }

    if (segment.hasOrdered === true) {
      and.push({ orders: { some: { status: 'paid' } } });
    } else if (segment.hasOrdered === false) {
      and.push({ orders: { none: { status: 'paid' } } });
    }

    if (segment.activeSince) {
      and.push({
        accessTokens: {
          some: { lastUsedAt: { gte: new Date(segment.activeSince) } },
        },
      });
    }

    if (segment.inactiveSince) {
      and.push({
        accessTokens: {
          none: { lastUsedAt: { gte: new Date(segment.inactiveSince) } },
        },
      });
    }

    if (segment.hasUpcomingRsvp === true) {
      and.push({
        rsvps: { some: { event: { startsAt: { gte: new Date() } } } },
      });
    }

    return { AND: and };
  }

  async count(
    segment: SegmentDefinition,
    options: { requireMarketingConsent: boolean },
  ): Promise<number> {
    return this.prisma.user.count({ where: this.where(segment, options) });
  }

  /** Distinct cities present on onboarded profiles — populates the segment builder. */
  async cities(): Promise<string[]> {
    const rows = await this.prisma.profile.findMany({
      where: { city: { not: null }, completedAt: { not: null } },
      distinct: ['city'],
      select: { city: true },
      orderBy: { city: 'asc' },
    });

    return rows
      .map((row) => row.city)
      .filter((city): city is string => city !== null);
  }
}
