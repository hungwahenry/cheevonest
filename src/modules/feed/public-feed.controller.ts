import { Controller, Get, Query } from '@nestjs/common';
import { Paginated } from '../../common/responses/paginated';
import { Public } from '../auth/decorators/auth.decorators';
import { SystemConfigService } from '../platform/system-config/system-config.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PublicFeedService } from './public-feed.service';

@Public()
@Controller('feed')
export class PublicFeedController {
  constructor(
    private readonly feed: PublicFeedService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  @Get()
  async index(@Query() dto: FeedQueryDto): Promise<Paginated<unknown>> {
    const perDefault = await this.systemConfig.int(
      'search.per_page_default',
      20,
    );
    const perMax = await this.systemConfig.int('search.per_page_max', 50);

    return this.feed.feed(
      dto.page ?? 1,
      Math.min(dto.per_page ?? perDefault, perMax),
    );
  }
}
