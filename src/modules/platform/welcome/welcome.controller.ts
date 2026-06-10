import { Controller, Get } from '@nestjs/common';
import { StorageService } from '../../../integrations/storage/storage.service';
import { Public } from '../../auth/decorators/auth.decorators';
import { WelcomeService } from './welcome.service';

@Public()
@Controller('welcome')
export class WelcomeController {
  constructor(
    private readonly welcome: WelcomeService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async show(): Promise<Record<string, unknown>> {
    const content = await this.welcome.content();

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
