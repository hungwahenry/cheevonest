import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { User } from '../../../generated/prisma/client';

export const USER_RESOURCE_INCLUDE = {
  profile: true,
  interests: {
    include: { interest: true },
    orderBy: { interest: { sortOrder: Prisma.SortOrder.asc } },
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
  async createWithProfile(email: string): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { id: ulid(), email },
      });

      await tx.profile.create({
        data: {
          id: ulid(),
          userId: user.id,
          referralCode: await this.uniqueReferralCode(),
        },
      });

      return user;
    });
  }

  async findForResource(userId: string): Promise<UserForResource> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: USER_RESOURCE_INCLUDE,
    });
  }

  async isUsernameAvailable(
    username: string,
    ownUserId: string,
  ): Promise<boolean> {
    const taken = await this.prisma.profile.findFirst({
      where: { username, NOT: { userId: ownUserId } },
      select: { id: true },
    });

    return taken === null;
  }

  async assertUsernameAvailable(
    username: string,
    ownUserId: string,
  ): Promise<void> {
    if (!(await this.isUsernameAvailable(username, ownUserId))) {
      throw new ValidationFailedException({
        username: ['The username has already been taken.'],
      });
    }
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
