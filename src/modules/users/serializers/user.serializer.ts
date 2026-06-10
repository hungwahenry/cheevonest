import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import type { Interest, Profile } from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { UserForResource } from '../services/users.service';

export interface SerializeUserOptions {
  includeOrganisations?: boolean;
}

@Injectable()
export class UserSerializer {
  private readonly dicebearBase: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly storage: StorageService,
    private readonly organisations: OrganisationSerializer,
  ) {
    const url = config.get('DICEBEAR_URL', { infer: true }).replace(/\/$/, '');
    const style = config.get('DICEBEAR_STYLE', { infer: true });
    const format = config.get('DICEBEAR_FORMAT', { infer: true });

    this.dicebearBase = `${url}/${style}/${format}`;
  }

  user(
    user: UserForResource,
    options: SerializeUserOptions = {},
  ): Record<string, unknown> {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      email_verified: user.emailVerifiedAt !== null,
      onboarding_completed: user.profile?.completedAt != null,
      is_organizer: user.memberships.length > 0,
      profile: user.profile ? this.profile(user.profile) : null,
      interests: user.interests.map(({ interest }) => this.interest(interest)),
      ...(options.includeOrganisations
        ? {
            organisations: user.memberships.map((membership) =>
              this.organisations.organisation(membership.organisation),
            ),
          }
        : {}),
    };
  }

  profile(profile: Profile): Record<string, unknown> {
    return {
      id: profile.id,
      first_name: profile.firstName,
      last_name: profile.lastName,
      username: profile.username,
      avatar_url: this.avatarUrl(profile),
      gender: profile.gender,
      bio: profile.bio,
      date_of_birth: profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      city: profile.city,
      place_name: profile.placeName,
      latitude: profile.latitude?.toFixed(7) ?? null,
      longitude: profile.longitude?.toFixed(7) ?? null,
      marketing_opt_in: profile.marketingOptIn,
      referral_code: profile.referralCode,
      completed: profile.completedAt !== null,
    };
  }

  interest(interest: Interest): Record<string, unknown> {
    return {
      id: interest.id,
      slug: interest.slug,
      name: interest.name,
    };
  }

  /** Uploaded avatar when present, otherwise a deterministic DiceBear avatar. */
  avatarUrl(profile: Profile): string {
    if (profile.avatarPath !== null) {
      return this.storage.url(profile.avatarPath);
    }

    const seed = profile.username ?? profile.userId;

    return `${this.dicebearBase}?seed=${encodeURIComponent(seed)}`;
  }
}
