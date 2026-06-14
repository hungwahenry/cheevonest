import { Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import { ReportReasonInUseException } from '../exceptions/report-reason-in-use.exception';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- interests (int id) -----
  interests() {
    return this.prisma.interest.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  createInterest(data: { slug: string; name: string; sortOrder?: number }) {
    return this.prisma.interest.create({
      data: {
        slug: data.slug,
        name: data.name,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  updateInterest(
    id: number,
    data: {
      slug?: string;
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.interest.update({ where: { id }, data });
  }

  async deleteInterest(id: number): Promise<void> {
    await this.prisma.interest.delete({ where: { id } });
  }

  // ----- organisation categories (int id) -----
  categories() {
    return this.prisma.organisationCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  createCategory(data: { slug: string; name: string; sortOrder?: number }) {
    return this.prisma.organisationCategory.create({
      data: {
        slug: data.slug,
        name: data.name,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  updateCategory(
    id: number,
    data: {
      slug?: string;
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.organisationCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: number): Promise<void> {
    await this.prisma.organisationCategory.delete({ where: { id } });
  }

  // ----- social platforms (int id) -----
  platforms() {
    return this.prisma.socialPlatform.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  createPlatform(data: {
    slug: string;
    name: string;
    baseUrl?: string | null;
    sortOrder?: number;
  }) {
    return this.prisma.socialPlatform.create({
      data: {
        slug: data.slug,
        name: data.name,
        baseUrl: data.baseUrl ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  updatePlatform(
    id: number,
    data: {
      slug?: string;
      name?: string;
      baseUrl?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.socialPlatform.update({ where: { id }, data });
  }

  async deletePlatform(id: number): Promise<void> {
    await this.prisma.socialPlatform.delete({ where: { id } });
  }

  // ----- report reasons (ulid id) -----
  reportReasons() {
    return this.prisma.reportReason.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  createReportReason(data: {
    slug: string;
    label: string;
    description?: string | null;
    scopeTypes?: string[];
    requiresDetails?: boolean;
    displayOrder?: number;
  }) {
    return this.prisma.reportReason.create({
      data: {
        id: ulid(),
        slug: data.slug,
        label: data.label,
        description: data.description ?? null,
        scopeTypes: data.scopeTypes ?? [],
        requiresDetails: data.requiresDetails ?? false,
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  updateReportReason(
    id: string,
    data: {
      slug?: string;
      label?: string;
      description?: string | null;
      scopeTypes?: string[];
      requiresDetails?: boolean;
      displayOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.reportReason.update({ where: { id }, data });
  }

  /** Refuses deletion while reports reference it — deactivate instead. */
  async deleteReportReason(id: string): Promise<void> {
    const inUse = await this.prisma.report.count({
      where: { reportReasonId: id },
    });

    if (inUse > 0) {
      throw new ReportReasonInUseException(inUse);
    }

    await this.prisma.reportReason.delete({ where: { id } });
  }

  async reportReasonOrFail(id: string) {
    const reason = await this.prisma.reportReason.findUnique({ where: { id } });

    if (!reason) {
      throw new NotFoundException();
    }

    return reason;
  }
}
