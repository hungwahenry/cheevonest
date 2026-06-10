import { ulid } from 'ulid';
import type { PrismaClient } from '../src/generated/prisma/client';
import {
  FEATURE_FLAGS,
  INTERESTS,
  ORGANISATION_CATEGORIES,
  SOCIAL_PLATFORMS,
  SYSTEM_CONFIGS,
} from './seed-data';

type Seedable = Pick<
  PrismaClient,
  | 'interest'
  | 'systemConfig'
  | 'featureFlag'
  | 'organisationCategory'
  | 'socialPlatform'
>;

export async function seedInterests(prisma: Seedable): Promise<void> {
  for (const [index, interest] of INTERESTS.entries()) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: { name: interest.name, sortOrder: index, isActive: true },
      create: {
        slug: interest.slug,
        name: interest.name,
        sortOrder: index,
        isActive: true,
      },
    });
  }
}

export async function seedSystemConfigs(prisma: Seedable): Promise<void> {
  for (const config of SYSTEM_CONFIGS) {
    const payload = { v: config.default };

    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {
        description: config.description,
        group: config.group,
        type: config.type,
        value: payload,
        defaultValue: payload,
        isPublic: config.isPublic ?? false,
      },
      create: {
        id: ulid(),
        key: config.key,
        description: config.description,
        group: config.group,
        type: config.type,
        value: payload,
        defaultValue: payload,
        isPublic: config.isPublic ?? false,
      },
    });
  }
}

export async function seedOrganisationCatalog(prisma: Seedable): Promise<void> {
  for (const [index, category] of ORGANISATION_CATEGORIES.entries()) {
    await prisma.organisationCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: index, isActive: true },
      create: {
        slug: category.slug,
        name: category.name,
        sortOrder: index,
        isActive: true,
      },
    });
  }

  for (const [index, platform] of SOCIAL_PLATFORMS.entries()) {
    await prisma.socialPlatform.upsert({
      where: { slug: platform.slug },
      update: {
        name: platform.name,
        baseUrl: platform.baseUrl,
        sortOrder: index,
        isActive: true,
      },
      create: {
        slug: platform.slug,
        name: platform.name,
        baseUrl: platform.baseUrl,
        sortOrder: index,
        isActive: true,
      },
    });
  }
}

export async function seedFeatureFlags(prisma: Seedable): Promise<void> {
  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        description: flag.description,
        enabled: flag.enabled,
        rolloutPct: flag.rolloutPct ?? 100,
        isPublic: flag.isPublic ?? false,
      },
      create: {
        id: ulid(),
        key: flag.key,
        description: flag.description,
        enabled: flag.enabled,
        rolloutPct: flag.rolloutPct ?? 100,
        isPublic: flag.isPublic ?? false,
      },
    });
  }
}
