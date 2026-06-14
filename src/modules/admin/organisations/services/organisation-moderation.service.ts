import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { Organisation } from '../../../../generated/prisma/client';
import { OrganisationsService } from '../../../organisations/organisations.service';
import { OrganisationNotSuspendedException } from '../exceptions/organisation-not-suspended.exception';
import { OwnerCandidateNotMemberException } from '../exceptions/owner-candidate-not-member.exception';

@Injectable()
export class OrganisationModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organisations: OrganisationsService,
  ) {}

  async suspend(
    organisation: Organisation,
    reason: string,
  ): Promise<Organisation> {
    const updated = await this.prisma.organisation.update({
      where: { id: organisation.id },
      data: { suspendedAt: new Date(), suspendedReason: reason },
    });
    await this.organisations.deindexFromSearch(organisation.id);
    return updated;
  }

  async unsuspend(organisation: Organisation): Promise<Organisation> {
    if (organisation.suspendedAt === null) {
      throw new OrganisationNotSuspendedException();
    }

    const updated = await this.prisma.organisation.update({
      where: { id: organisation.id },
      data: { suspendedAt: null, suspendedReason: null },
    });
    await this.organisations.reindexInSearch(updated);
    return updated;
  }

  /** Demotes the current owner and promotes a member, atomically. */
  async changeOwner(
    organisation: Organisation,
    newOwnerId: string,
  ): Promise<Organisation> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.organisationMember.findUnique({
        where: {
          organisationId_userId: {
            organisationId: organisation.id,
            userId: newOwnerId,
          },
        },
      });

      if (!membership) {
        throw new OwnerCandidateNotMemberException();
      }

      await tx.organisationMember.updateMany({
        where: { organisationId: organisation.id, role: 'owner' },
        data: { role: 'member' },
      });
      await tx.organisationMember.update({
        where: {
          organisationId_userId: {
            organisationId: organisation.id,
            userId: newOwnerId,
          },
        },
        data: { role: 'owner' },
      });

      return tx.organisation.findUniqueOrThrow({
        where: { id: organisation.id },
      });
    });
  }

  async delete(organisation: Organisation): Promise<void> {
    await this.organisations.purge(organisation.id);
  }

  async findOrFail(organisationId: string): Promise<Organisation> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
    });

    if (!organisation) {
      throw new NotFoundException();
    }

    return organisation;
  }
}
