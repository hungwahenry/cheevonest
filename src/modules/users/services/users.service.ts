import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { User } from '../../../generated/prisma/client';
import { ORGANISATION_RESOURCE_INCLUDE } from '../../organisations/organisations.service';

export const USER_RESOURCE_INCLUDE = {
  profile: true,
  interests: {
    include: { interest: true },
    orderBy: { interest: { sortOrder: Prisma.SortOrder.asc } },
  },
  memberships: {
    include: { organisation: { include: ORGANISATION_RESOURCE_INCLUDE } },
    orderBy: { createdAt: Prisma.SortOrder.asc },
  },
} satisfies Prisma.UserInclude;

export type UserForResource = Prisma.UserGetPayload<{
  include: typeof USER_RESOURCE_INCLUDE;
}>;

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const REFERRAL_CODE_LENGTH = 8;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every user gets a profile holding a unique referral code at sign-up. */
  async createWithProfile(
    email: string,
    profile?: { firstName?: string | null; lastName?: string | null },
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { id: ulid(), email },
      });

      await tx.profile.create({
        data: {
          id: ulid(),
          userId: user.id,
          referralCode: await this.uniqueReferralCode(),
          firstName: profile?.firstName ?? null,
          lastName: profile?.lastName ?? null,
        },
      });

      return user;
    });
  }

  /** Resolve a user by email for web guest checkout; an existing account is returned untouched. */
  async findOrCreateByEmail(
    email: string,
    profile?: { firstName?: string | null; lastName?: string | null },
  ): Promise<User> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalized },
    });

    return existing ?? (await this.createWithProfile(normalized, profile));
  }

  async findForResource(userId: string): Promise<UserForResource> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: USER_RESOURCE_INCLUDE,
    });
  }

  async blockedOrganisationIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockerUserId: userId, blockableType: 'organisation' },
      select: { blockableId: true },
    });

    return blocks.map((block) => block.blockableId);
  }

  /** Users this user blocked plus users who blocked them — the symmetric guard. */
  async mutuallyBlockedUserIds(userId: string): Promise<string[]> {
    const [outgoing, incoming] = await Promise.all([
      this.prisma.block.findMany({
        where: { blockerUserId: userId, blockableType: 'user' },
        select: { blockableId: true },
      }),
      this.prisma.block.findMany({
        where: { blockableType: 'user', blockableId: userId },
        select: { blockerUserId: true },
      }),
    ]);

    return [
      ...new Set([
        ...outgoing.map((block) => block.blockableId),
        ...incoming.map((block) => block.blockerUserId),
      ]),
    ];
  }

  async hasBlocked(
    userId: string,
    targetType: 'user' | 'organisation',
    targetId: string,
  ): Promise<boolean> {
    const block = await this.prisma.block.findUnique({
      where: {
        blockerUserId_blockableType_blockableId: {
          blockerUserId: userId,
          blockableType: targetType,
          blockableId: targetId,
        },
      },
      select: { blockerUserId: true },
    });

    return block !== null;
  }

  private async uniqueReferralCode(): Promise<string> {
    for (;;) {
      const code = this.randomReferralCode();

      const exists = await this.prisma.profile.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });

      if (!exists) {
        return code;
      }
    }
  }

  private randomReferralCode(): string {
    const bytes = randomBytes(REFERRAL_CODE_LENGTH);

    return Array.from(
      bytes,
      (byte) => REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length],
    ).join('');
  }
}
