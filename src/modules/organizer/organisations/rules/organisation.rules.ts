import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../../common/exceptions/api.exception';
import { PrismaService } from '../../../../database/prisma.service';
import { SocialEntryDto } from '../dto/create-organisation.dto';

@Injectable()
export class OrganisationRules {
  constructor(private readonly prisma: PrismaService) {}

  async isSlugAvailable(slug: string): Promise<boolean> {
    const existing = await this.prisma.organisation.findUnique({
      where: { slug },
      select: { id: true },
    });

    return existing === null;
  }

  async ensureSlugAvailable(slug: string): Promise<void> {
    if (!(await this.isSlugAvailable(slug))) {
      throw new ValidationFailedException({
        slug: ['The slug has already been taken.'],
      });
    }
  }

  async ensureCategoryActive(categoryId: number): Promise<void> {
    const category = await this.prisma.organisationCategory.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    });

    if (!category) {
      throw new ValidationFailedException({
        category_id: ['The selected category id is invalid.'],
      });
    }
  }

  async ensureSocialPlatformsActive(socials: SocialEntryDto[]): Promise<void> {
    if (socials.length === 0) {
      return;
    }

    const ids = [...new Set(socials.map((social) => social.platform_id))];
    const found = await this.prisma.socialPlatform.count({
      where: { id: { in: ids }, isActive: true },
    });

    if (found !== ids.length) {
      throw new ValidationFailedException({
        socials: ['The selected socials are invalid.'],
      });
    }
  }
}
