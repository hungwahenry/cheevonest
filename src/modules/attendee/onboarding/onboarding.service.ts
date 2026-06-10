import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { PrismaService } from '../../../database/prisma.service';
import type { Profile, User } from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import { SearchIndexerService } from '../../search/services/search-indexer.service';
import { UsernameRules } from '../../users/rules/username.rules';
import {
  UserForResource,
  UsersService,
} from '../../users/services/users.service';
import { InterestRules } from '../interests/rules/interest.rules';
import { InterestsService } from '../interests/interests.service';
import { ensureValidAvatar } from '../rules/avatar.rules';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
    private readonly usernameRules: UsernameRules,
    private readonly interests: InterestsService,
    private readonly interestRules: InterestRules,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  async complete(
    user: User,
    dto: CompleteProfileDto,
  ): Promise<UserForResource> {
    this.ensureDateOfBirthInPast(dto.date_of_birth);

    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { userId: user.id },
    });

    await this.usernameRules.ensureAvailable(dto.username, user.id);
    await this.interestRules.ensureActive(dto.interests);

    const referredByUserId = await this.resolveReferral(
      user,
      profile,
      dto.referral_code ?? null,
    );

    const avatarPath = await this.storeAvatar(profile, dto.avatar);

    await this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        firstName: dto.first_name,
        lastName: dto.last_name,
        username: dto.username,
        gender: dto.gender,
        bio: dto.bio ?? null,
        dateOfBirth: new Date(dto.date_of_birth),
        latitude: dto.latitude,
        longitude: dto.longitude,
        placeName: dto.place_name,
        city: dto.city ?? null,
        marketingOptIn: dto.marketing_opt_in ?? false,
        completedAt: new Date(),
        ...(avatarPath !== null ? { avatarPath } : {}),
        ...(referredByUserId !== null ? { referredByUserId } : {}),
      },
    });

    await this.interests.syncFor(user.id, dto.interests);

    await this.searchIndexer.indexUser(user.id);

    return this.users.findForResource(user.id);
  }

  private ensureDateOfBirthInPast(dateOfBirth: string): void {
    const today = new Date().toISOString().slice(0, 10);

    if (dateOfBirth >= today) {
      throw new ValidationFailedException({
        date_of_birth: ['The date of birth must be a date before today.'],
      });
    }
  }

  private async resolveReferral(
    user: User,
    profile: Profile,
    code: string | null,
  ): Promise<string | null> {
    if (code === null || profile.referredByUserId !== null) {
      return null;
    }

    const referrer = await this.prisma.profile.findUnique({
      where: { referralCode: code },
      select: { userId: true },
    });

    if (!referrer) {
      throw new ValidationFailedException({
        referral_code: ['The selected referral code is invalid.'],
      });
    }

    return referrer.userId === user.id ? null : referrer.userId;
  }

  private async storeAvatar(
    profile: Profile,
    avatar: CompleteProfileDto['avatar'],
  ): Promise<string | null> {
    if (!avatar) {
      return null;
    }

    ensureValidAvatar(avatar);

    if (profile.avatarPath !== null) {
      await this.storage.delete(profile.avatarPath);
    }

    return this.storage.put(avatar, 'avatars');
  }
}
