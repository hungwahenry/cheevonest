import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';

export const ADMIN_ORG_INCLUDE = {
  category: true,
} satisfies Prisma.OrganisationInclude;

export type AdminOrganisation = Prisma.OrganisationGetPayload<{
  include: typeof ADMIN_ORG_INCLUDE;
}>;

@Injectable()
export class AdminOrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(options: {
    page: number;
    perPage: number;
    search?: string;
    suspended?: boolean;
  }): Promise<{ items: AdminOrganisation[]; total: number }> {
    const search = options.search?.trim() ?? '';

    const where: Prisma.OrganisationWhereInput = {
      ...(options.suspended === true ? { suspendedAt: { not: null } } : {}),
      ...(options.suspended === false ? { suspendedAt: null } : {}),
      ...(search !== ''
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.organisation.count({ where }),
      this.prisma.organisation.findMany({
        where,
        include: ADMIN_ORG_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  async detail(organisationId: string) {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      include: ADMIN_ORG_INCLUDE,
    });

    if (!organisation) {
      throw new NotFoundException();
    }

    const [
      members,
      eventsRecent,
      payoutsRecent,
      broadcastsRecent,
      ticketsSoldAgg,
      paidOutAgg,
      openReports,
    ] = await this.prisma.$transaction([
      this.prisma.organisationMember.findMany({
        where: { organisationId },
        include: { user: { include: { profile: true } } },
      }),
      this.prisma.event.findMany({
        where: { organisationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.payout.findMany({
        where: { organisationId },
        orderBy: { requestedAt: 'desc' },
        take: 10,
      }),
      this.prisma.broadcast.findMany({
        where: { organisationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.event.aggregate({
        where: { organisationId },
        _sum: { ticketsSold: true, revenueMinor: true },
      }),
      this.prisma.payout.aggregate({
        where: { organisationId, status: 'paid' },
        _sum: { amountMinor: true },
      }),
      this.prisma.report.count({
        where: { targetType: 'organisation', targetId: organisationId },
      }),
    ]);

    return {
      organisation,
      stats: {
        // counter caches where they exist, live aggregate otherwise
        events_count: organisation.eventsCount,
        subscribers_count: organisation.subscribersCount,
        total_revenue_minor: Number(ticketsSoldAgg._sum.revenueMinor ?? 0n),
        tickets_sold: ticketsSoldAgg._sum.ticketsSold ?? 0,
        members_count: members.length,
        paid_out_minor: Number(paidOutAgg._sum.amountMinor ?? 0n),
        reports_against: openReports,
      },
      members,
      eventsRecent,
      payoutsRecent,
      broadcastsRecent,
    };
  }
}
