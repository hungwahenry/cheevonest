import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Interest } from '../../../generated/prisma/client';

@Injectable()
export class InterestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<Interest[]> {
    return this.prisma.interest.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async listFor(userId: string): Promise<Interest[]> {
    const pivot = await this.prisma.interestUser.findMany({
      where: { userId },
      include: { interest: true },
      orderBy: { interest: { sortOrder: 'asc' } },
    });

    return pivot.map(({ interest }) => interest);
  }

  async syncFor(userId: string, ids: number[]): Promise<void> {
    const unique = [...new Set(ids)];

    await this.prisma.$transaction([
      this.prisma.interestUser.deleteMany({ where: { userId } }),
      this.prisma.interestUser.createMany({
        data: unique.map((interestId) => ({ userId, interestId })),
      }),
    ]);
  }
}
