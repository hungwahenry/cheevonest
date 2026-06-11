import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Event } from '../../generated/prisma/client';

@Injectable()
export class EventsPolicy {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCanCreate(userId: string): Promise<void> {
    const membership = await this.prisma.organisationMember.findFirst({
      where: { userId },
      select: { organisationId: true },
    });

    if (!membership) {
      throw new ForbiddenException();
    }
  }

  async ensureMember(
    event: Pick<Event, 'organisationId'>,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.organisationMember.findUnique({
      where: {
        organisationId_userId: {
          organisationId: event.organisationId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException();
    }
  }

  async ensureOwner(
    event: Pick<Event, 'organisationId'>,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.organisationMember.findUnique({
      where: {
        organisationId_userId: {
          organisationId: event.organisationId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException();
    }
  }
}
