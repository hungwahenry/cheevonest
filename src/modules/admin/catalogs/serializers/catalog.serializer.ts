import { Injectable } from '@nestjs/common';
import { StorageService } from '../../../../integrations/storage/storage.service';
import type {
  Interest,
  OrganisationCategory,
  ReportReason,
  SocialPlatform,
} from '../../../../generated/prisma/client';

@Injectable()
export class CatalogSerializer {
  constructor(private readonly storage: StorageService) {}

  interest(interest: Interest): Record<string, unknown> {
    return {
      id: interest.id,
      slug: interest.slug,
      name: interest.name,
      sort_order: interest.sortOrder,
      is_active: interest.isActive,
    };
  }

  category(category: OrganisationCategory): Record<string, unknown> {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      sort_order: category.sortOrder,
      is_active: category.isActive,
    };
  }

  platform(platform: SocialPlatform): Record<string, unknown> {
    return {
      id: platform.id,
      slug: platform.slug,
      name: platform.name,
      base_url: platform.baseUrl,
      sort_order: platform.sortOrder,
      is_active: platform.isActive,
    };
  }

  reportReason(reason: ReportReason): Record<string, unknown> {
    return {
      id: reason.id,
      slug: reason.slug,
      label: reason.label,
      description: reason.description,
      scope_types: reason.scopeTypes,
      requires_details: reason.requiresDetails,
      display_order: reason.displayOrder,
      is_active: reason.isActive,
    };
  }
}
