import { Injectable } from '@nestjs/common';
import type {
  Organisation,
  OrganisationCategory,
  SocialPlatform,
} from '../../generated/prisma/client';
import { StorageService } from '../../integrations/storage/storage.service';
import { OrganisationForResource } from './organisations.service';

export type OrganisationWithCategory = Organisation & {
  category: OrganisationCategory | null;
};

export interface PublicOrganisationFlags {
  isSubscribed: boolean;
  isBlocked: boolean;
}

@Injectable()
export class OrganisationSerializer {
  constructor(private readonly storage: StorageService) {}

  organisation(organisation: OrganisationForResource): Record<string, unknown> {
    return {
      ...this.bare(organisation),
      category: organisation.category
        ? this.category(organisation.category)
        : null,
      socials: organisation.socials.map((social) => ({
        platform: social.platform.slug,
        name: social.platform.name,
        handle: social.handle,
        url: social.platform.baseUrl
          ? `${social.platform.baseUrl}${social.handle}`
          : null,
      })),
    };
  }

  summary(organisation: OrganisationWithCategory): Record<string, unknown> {
    return {
      ...this.bare(organisation),
      category: organisation.category
        ? this.category(organisation.category)
        : null,
    };
  }

  bare(organisation: Organisation): Record<string, unknown> {
    return {
      id: organisation.id,
      name: organisation.name,
      slug: organisation.slug,
      logo_url: this.logoUrl(organisation),
      cover_url:
        organisation.coverPath !== null
          ? this.storage.url(organisation.coverPath)
          : null,
      about: organisation.about,
      contact_email: organisation.contactEmail,
      contact_phone: organisation.contactPhone,
      website: organisation.website,
      city: organisation.city,
      events_count: organisation.eventsCount,
      subscribers_count: organisation.subscribersCount,
      hosting_since: organisation.createdAt.toISOString(),
    };
  }

  publicOrganisation(
    organisation: OrganisationForResource,
    flags: PublicOrganisationFlags,
  ): Record<string, unknown> {
    return {
      ...this.organisation(organisation),
      is_subscribed: flags.isSubscribed,
      is_blocked: flags.isBlocked,
    };
  }

  logoUrl(organisation: Organisation): string | null {
    return organisation.logoPath !== null
      ? this.storage.url(organisation.logoPath)
      : null;
  }

  category(category: OrganisationCategory): Record<string, unknown> {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
    };
  }

  socialPlatform(platform: SocialPlatform): Record<string, unknown> {
    return {
      id: platform.id,
      slug: platform.slug,
      name: platform.name,
      base_url: platform.baseUrl,
    };
  }
}
