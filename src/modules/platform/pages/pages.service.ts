import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Page } from '../../../generated/prisma/client';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(): Promise<
    Array<Pick<Page, 'slug' | 'title' | 'updatedAt'>>
  > {
    return this.prisma.page.findMany({
      where: { isPublished: true },
      orderBy: { title: 'asc' },
      select: { slug: true, title: true, updatedAt: true },
    });
  }

  async findPublishedOrFail(slug: string): Promise<Page> {
    const page = await this.prisma.page.findFirst({
      where: { slug, isPublished: true },
    });

    if (!page) {
      throw new NotFoundException();
    }

    return page;
  }
}
