import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { User } from '../../../../generated/prisma/client';
import { OrganisationsService } from '../../../organisations/organisations.service';
import { CannotRemoveOwnerException } from '../exceptions/cannot-remove-owner.exception';
import { OrganisationMemberAlreadyExistsException } from '../exceptions/organisation-member-already-exists.exception';
import { OrganisationMemberNotFoundException } from '../exceptions/organisation-member-not-found.exception';

export const MEMBER_RESOURCE_INCLUDE = {
  user: { include: { profile: true } },
} satisfies Prisma.OrganisationMemberInclude;

export type MemberForResource = Prisma.OrganisationMemberGetPayload<{
  include: typeof MEMBER_RESOURCE_INCLUDE;
}>;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organisations: OrganisationsService,
  ) {}

  async list(organisationId: string): Promise<MemberForResource[]> {
    return this.prisma.organisationMember.findMany({
      where: { organisationId },
      include: MEMBER_RESOURCE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async addByEmail(
    organisationId: string,
    email: string,
  ): Promise<MemberForResource> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (user === null) {
      throw new OrganisationMemberNotFoundException();
    }

    if (await this.organisations.hasMember(organisationId, user.id)) {
      throw new OrganisationMemberAlreadyExistsException();
    }

    return this.prisma.organisationMember.create({
      data: { organisationId, userId: user.id, role: 'member' },
      include: MEMBER_RESOURCE_INCLUDE,
    });
  }

  async remove(organisationId: string, user: User): Promise<void> {
    const role = await this.organisations.roleOf(organisationId, user.id);

    if (role === 'owner') {
      throw new CannotRemoveOwnerException();
    }

    await this.prisma.organisationMember.deleteMany({
      where: { organisationId, userId: user.id },
    });
  }
}
