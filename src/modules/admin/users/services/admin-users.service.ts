import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { User } from '../../../../generated/prisma/client';

export const ADMIN_USER_INCLUDE = {
  profile: true,
} satisfies Prisma.UserInclude;

export type AdminUser = Prisma.UserGetPayload<{
  include: typeof ADMIN_USER_INCLUDE;
}>;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrFail(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }

  async page(options: {
    page: number;
    perPage: number;
    search?: string;
    suspended?: boolean;
    role?: string;
  }): Promise<{ items: AdminUser[]; total: number }> {
    const search = options.search?.trim() ?? '';

    const where: Prisma.UserWhereInput = {
      ...(options.suspended === true ? { suspendedAt: { not: null } } : {}),
      ...(options.suspended === false ? { suspendedAt: null } : {}),
      ...(options.role ? { role: options.role as User['role'] } : {}),
      ...(search !== ''
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              {
                profile: {
                  OR: [
                    { username: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: ADMIN_USER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
    ]);

    return { items, total };
  }

  /** The 360 graph: account + profile + every connected collection, stats, sessions. */
  async detail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: ADMIN_USER_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException();
    }

    const [
      orderAgg,
      ordersRecent,
      ticketsHeld,
      ticketsRecent,
      commentsCount,
      rsvpsCount,
      reportsFiled,
      reportsAgainst,
      memberships,
      sessions,
      outgoingBlocks,
      incomingBlocks,
      unreadNotifications,
    ] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { userId, status: 'paid' },
        _sum: { totalMinor: true },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { userId },
        include: { event: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.issuedTicket.count({ where: { holderUserId: userId } }),
      this.prisma.issuedTicket.findMany({
        where: { holderUserId: userId },
        include: { event: true, ticket: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.eventComment.count({ where: { userId } }),
      this.prisma.eventRsvp.count({ where: { userId } }),
      this.prisma.report.count({ where: { reporterUserId: userId } }),
      this.prisma.report.count({
        where: { targetType: 'user', targetId: userId },
      }),
      this.prisma.organisationMember.findMany({
        where: { userId },
        include: { organisation: true },
        take: 10,
      }),
      this.prisma.accessToken.findMany({
        where: { userId },
        orderBy: { lastUsedAt: { sort: 'desc', nulls: 'last' } },
        take: 10,
      }),
      this.prisma.block.findMany({
        where: { blockerUserId: userId },
        take: 10,
      }),
      this.prisma.block.count({
        where: { blockableType: 'user', blockableId: userId },
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return {
      user,
      stats: {
        orders_count: orderAgg._count._all,
        total_spent_minor: Number(orderAgg._sum.totalMinor ?? 0n),
        tickets_held: ticketsHeld,
        comments_count: commentsCount,
        rsvps_count: rsvpsCount,
        reports_filed: reportsFiled,
        reports_against: reportsAgainst,
        active_sessions: sessions.length,
        blocks_outgoing: outgoingBlocks.length,
        blocks_incoming: incomingBlocks,
        unread_notifications: unreadNotifications,
      },
      ordersRecent,
      ticketsRecent,
      memberships,
      sessions,
    };
  }
}
