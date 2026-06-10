import { Controller, Get, Query } from '@nestjs/common';
import { OrganisationSerializer } from '../../../organisations/organisation.serializer';
import { OrganisationsService } from '../../../organisations/organisations.service';
import { OrganisationRules } from '../rules/organisation.rules';
import { CheckSlugDto } from '../dto/check-slug.dto';

@Controller('organizer')
export class CatalogController {
  constructor(
    private readonly organisations: OrganisationsService,
    private readonly serializer: OrganisationSerializer,
    private readonly rules: OrganisationRules,
  ) {}

  @Get('organisation-categories')
  async categories(): Promise<unknown[]> {
    const categories = await this.organisations.activeCategories();

    return categories.map((category) => this.serializer.category(category));
  }

  @Get('social-platforms')
  async socialPlatforms(): Promise<unknown[]> {
    const platforms = await this.organisations.activeSocialPlatforms();

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
      available: await this.rules.isSlugAvailable(dto.slug),
    };
  }
}
