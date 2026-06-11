import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

export type CompletedUser = Prisma.UserGetPayload<{
  include: { profile: true };
}>;

@Injectable()
export class PublicProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public profiles exist only for onboarded users — everyone else 404s. */
  async findCompletedOrFail(userId: string): Promise<CompletedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile || user.profile.completedAt === null) {
      throw new NotFoundException();
    }

    return user;
  }

  async interests(userId: string) {
    const pivot = await this.prisma.interestUser.findMany({
      where: { userId },
      include: { interest: true },
      orderBy: { interest: { name: 'asc' } },
    });

    return pivot.map(({ interest }) => interest);
  }

  async subscribedOrganisationsPage(
    userId: string,
    page: number,
    perPage: number,
  ) {
    const where: Prisma.OrganisationWhereInput = {
      subscriptions: { some: { userId } },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.organisation.count({ where }),
      this.prisma.organisation.findMany({
        where,
        include: { category: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total };
  }

  async attendedEventsPage(userId: string, page: number, perPage: number) {
    const where: Prisma.EventWhereInput = {
      status: 'past',
      rsvps: { some: { userId } },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: { organisation: true },
        orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { items, total };
  }
}
