import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type {
  Organisation,
  OrganisationRole,
} from '../../generated/prisma/client';

export const ORGANISATION_RESOURCE_INCLUDE = {
  category: true,
  socials: {
    include: { platform: true },
    orderBy: { socialPlatformId: Prisma.SortOrder.asc },
  },
} satisfies Prisma.OrganisationInclude;

export type OrganisationForResource = Prisma.OrganisationGetPayload<{
  include: typeof ORGANISATION_RESOURCE_INCLUDE;
}>;

@Injectable()
export class OrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrFail(id: string): Promise<Organisation> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id },
    });

    if (!organisation) {
      throw new NotFoundException();
    }

    return organisation;
  }

  async loadForResource(id: string): Promise<OrganisationForResource> {
    return this.prisma.organisation.findUniqueOrThrow({
      where: { id },
      include: ORGANISATION_RESOURCE_INCLUDE,
    });
  }

  async roleOf(
    organisationId: string,
    userId: string,
  ): Promise<OrganisationRole | null> {
    const membership = await this.prisma.organisationMember.findUnique({
      where: { organisationId_userId: { organisationId, userId } },
      select: { role: true },
    });

    return membership?.role ?? null;
  }

  async hasMember(organisationId: string, userId: string): Promise<boolean> {
    return (await this.roleOf(organisationId, userId)) !== null;
  }
}
