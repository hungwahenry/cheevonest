import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
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

  async assertActive(ids: number[]): Promise<void> {
    const found = await this.prisma.interest.count({
      where: { id: { in: ids }, isActive: true },
    });

    if (found !== new Set(ids).size) {
      throw new ValidationFailedException({
        interests: ['The selected interests are invalid.'],
      });
    }
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
