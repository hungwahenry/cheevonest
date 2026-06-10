import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../integrations/storage/storage.service';
import { Public } from '../../auth/decorators/auth.decorators';

const DEFAULT_HEADLINE = 'Find your people, find your night.';
const DEFAULT_SUBHEADLINE =
  "Discover parties, concerts and events near you — and see who's going.";

@Public()
@Controller('welcome')
export class WelcomeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async show(): Promise<Record<string, unknown>> {
    const content =
      (await this.prisma.welcomeContent.findFirst({
        orderBy: { id: 'asc' },
      })) ??
      (await this.prisma.welcomeContent.create({
        data: { headline: DEFAULT_HEADLINE, subheadline: DEFAULT_SUBHEADLINE },
      }));

    return {
      background_url:
        content.backgroundPath !== null
          ? this.storage.url(content.backgroundPath)
          : null,
      headline: content.headline,
      subheadline: content.subheadline,
    };
  }
}
