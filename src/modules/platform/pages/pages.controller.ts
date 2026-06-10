import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Public } from '../../auth/decorators/auth.decorators';

@Public()
@Controller('pages')
export class PagesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<unknown[]> {
    const pages = await this.prisma.page.findMany({
      where: { isPublished: true },
      orderBy: { title: 'asc' },
      select: { slug: true, title: true, updatedAt: true },
    });

    return pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      updated_at: page.updatedAt.toISOString(),
    }));
  }

  @Get(':slug')
  async show(@Param('slug') slug: string): Promise<Record<string, unknown>> {
    const page = await this.prisma.page.findFirst({
      where: { slug, isPublished: true },
    });

    if (!page) {
      throw new NotFoundException();
    }

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
