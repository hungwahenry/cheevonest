import { Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import type { Page } from '../../../../generated/prisma/client';

@Injectable()
export class AdminPagesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.page.findMany({ orderBy: { title: 'asc' } });
  }

  async findOrFail(id: string): Promise<Page> {
    const page = await this.prisma.page.findUnique({ where: { id } });

    if (!page) {
      throw new NotFoundException();
    }

    return page;
  }

  create(data: {
    slug: string;
    title: string;
    bodyHtml: string;
    metaDescription?: string | null;
  }): Promise<Page> {
    return this.prisma.page.create({
      data: {
        id: ulid(),
        slug: data.slug,
        title: data.title,
        bodyHtml: data.bodyHtml,
        metaDescription: data.metaDescription ?? null,
      },
    });
  }

  update(
    id: string,
    data: {
      slug?: string;
      title?: string;
      bodyHtml?: string;
      metaDescription?: string | null;
    },
  ): Promise<Page> {
    return this.prisma.page.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.page.delete({ where: { id } });
  }

  setPublished(id: string, published: boolean): Promise<Page> {
    return this.prisma.page.update({
      where: { id },
      data: {
        isPublished: published,
        publishedAt: published ? new Date() : null,
      },
    });
  }
}
