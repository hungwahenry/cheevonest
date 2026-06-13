import { Controller, Get, Query } from '@nestjs/common';

import { Paginated } from '../../../common/responses/paginated';

import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { FeedService } from './feed.service';
import { FeedQueryDto } from './dto/feed.dto';

@Controller('attendee/feed')
export class FeedController {
  constructor(
    private readonly feed: FeedService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  @Get()
  async index(
    @Query() dto: FeedQueryDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const perDefault = await this.systemConfig.int(
      'search.per_page_default',
      20,
    );
    const perMax = await this.systemConfig.int('search.per_page_max', 50);

    return this.feed.feed(
      user,
      dto.page ?? 1,
      Math.min(dto.per_page ?? perDefault, perMax),
    );
  }
}
