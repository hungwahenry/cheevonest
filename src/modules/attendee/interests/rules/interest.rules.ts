import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../../common/exceptions/api.exception';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class InterestRules {
  constructor(private readonly prisma: PrismaService) {}

  async ensureActive(ids: number[]): Promise<void> {
    const found = await this.prisma.interest.count({
      where: { id: { in: ids }, isActive: true },
    });

    if (found !== new Set(ids).size) {
      throw new ValidationFailedException({
        interests: ['The selected interests are invalid.'],
      });
    }
  }
}
