import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Organisation, User } from '../../../../generated/prisma/client';
import {
  ORGANISATION_RESOURCE_INCLUDE,
  OrganisationForResource,
} from '../../../organisations/organisations.service';
import { PublicOrganisationFlags } from '../../../organisations/organisation.serializer';
import { UsersService } from '../../../users/services/users.service';

@Injectable()
export class PublicOrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async showForViewer(
    slug: string,
    viewer: User,
  ): Promise<{
    organisation: OrganisationForResource;
    flags: PublicOrganisationFlags;
  }> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { slug },
      include: ORGANISATION_RESOURCE_INCLUDE,
    });

    if (!organisation) {
      throw new NotFoundException();
    }

    const [subscription, isBlocked] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: {
          userId_organisationId: {
            userId: viewer.id,
            organisationId: organisation.id,
          },
        },
        select: { userId: true },
      }),
      this.users.hasBlocked(viewer.id, 'organisation', organisation.id),
    ]);

    return {
      organisation,
      flags: { isSubscribed: subscription !== null, isBlocked },
    };
  }

  async eventsPage(slug: string, status: 'published' | 'past', page: number) {
    const organisation = await this.findBySlugOrFail(slug);
    const perPage = 20;
    const where = { organisationId: organisation.id, status } as const;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: { organisation: true },
        orderBy:
          status === 'published' ? { startsAt: 'asc' } : { endsAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total, perPage };
  }

  async subscribersSample(slug: string) {
    const organisation = await this.findBySlugOrFail(slug);

    const sample = await this.prisma.subscription.findMany({
      where: { organisationId: organisation.id },
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      count: organisation.subscribersCount,
      sample: sample.map((subscription) => subscription.user),
    };
  }

  private async findBySlugOrFail(slug: string): Promise<Organisation> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { slug },
    });

    if (!organisation) {
      throw new NotFoundException();
    }

    return organisation;
  }
}
