import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { OrganisationManagerService } from './organisation-manager.service';
import { CheckSlugDto } from './dto/check-slug.dto';

@Controller('organizer')
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: OrganisationSerializer,
    private readonly manager: OrganisationManagerService,
  ) {}

  @Get('organisation-categories')
  async categories(): Promise<unknown[]> {
    const categories = await this.prisma.organisationCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map((category) => this.serializer.category(category));
  }

  @Get('social-platforms')
  async socialPlatforms(): Promise<unknown[]> {
    const platforms = await this.prisma.socialPlatform.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return platforms.map((platform) =>
      this.serializer.socialPlatform(platform),
    );
  }

  @Get('slug-available')
  async slugAvailable(
    @Query() dto: CheckSlugDto,
  ): Promise<{ slug: string; available: boolean }> {
    return {
      slug: dto.slug,
      available: await this.manager.isSlugAvailable(dto.slug),
    };
  }
}
