import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../auth/decorators/auth.decorators';
import { PagesService } from './pages.service';

@Public()
@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  async list(): Promise<unknown[]> {
    const pages = await this.pages.listPublished();

    return pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      updated_at: page.updatedAt.toISOString(),
    }));
  }

  @Get(':slug')
  async show(@Param('slug') slug: string): Promise<Record<string, unknown>> {
    const page = await this.pages.findPublishedOrFail(slug);

    return {
      slug: page.slug,
      title: page.title,
      body_html: page.bodyHtml,
      meta_description: page.metaDescription,
      published_at: page.publishedAt?.toISOString() ?? null,
      updated_at: page.updatedAt.toISOString(),
    };
  }
}
