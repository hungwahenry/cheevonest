import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../../common/exceptions/api.exception';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class EventInterestRules {
  constructor(private readonly prisma: PrismaService) {}

  /** Slugs are the public contract; resolves them to ids for the pivot. */
  async resolveSlugs(slugs: string[]): Promise<number[]> {
    if (slugs.length === 0) {
      return [];
    }

    const unique = [...new Set(slugs)];
    const interests = await this.prisma.interest.findMany({
      where: { slug: { in: unique } },
      select: { id: true },
    });

    if (interests.length !== unique.length) {
      throw new ValidationFailedException({
        interests: ['The selected interests are invalid.'],
      });
    }

    return interests.map((interest) => interest.id);
  }
}
