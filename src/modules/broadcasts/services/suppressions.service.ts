import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { SuppressionReason } from '../../../generated/prisma/client';

@Injectable()
export class SuppressionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** organisationId null = global (bounce/complaint); set = per-org unsubscribe. */
  async suppress(
    email: string,
    organisationId: string | null,
    reason: SuppressionReason,
  ): Promise<void> {
    try {
      const existing = await this.prisma.broadcastSuppression.findFirst({
        where: { email: email.toLowerCase(), organisationId },
        select: { id: true },
      });

      if (existing) {
        return;
      }

      await this.prisma.broadcastSuppression.create({
        data: {
          id: ulid(),
          email: email.toLowerCase(),
          organisationId,
          reason,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }

      throw error;
    }
  }

  /** Lower-cased emails suppressed globally or for this organisation. */
  async suppressedEmailsFor(organisationId: string): Promise<Set<string>> {
    const rows = await this.prisma.broadcastSuppression.findMany({
      where: {
        OR: [{ organisationId: null }, { organisationId }],
      },
      select: { email: true },
    });

    return new Set(rows.map((row) => row.email.toLowerCase()));
  }
}
