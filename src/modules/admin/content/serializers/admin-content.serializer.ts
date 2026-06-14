import { Injectable } from '@nestjs/common';
import { StorageService } from '../../../../integrations/storage/storage.service';
import type { Page, WelcomeContent } from '../../../../generated/prisma/client';

@Injectable()
export class AdminContentSerializer {
  constructor(private readonly storage: StorageService) {}

  page(page: Page): Record<string, unknown> {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      body_html: page.bodyHtml,
      meta_description: page.metaDescription,
      is_published: page.isPublished,
      published_at: page.publishedAt?.toISOString() ?? null,
      created_at: page.createdAt.toISOString(),
      updated_at: page.updatedAt.toISOString(),
    };
  }

  welcome(content: WelcomeContent): Record<string, unknown> {
    return {
      headline: content.headline,
      subheadline: content.subheadline,
      background_url:
        content.backgroundPath !== null
          ? this.storage.url(content.backgroundPath)
          : null,
    };
  }
}
