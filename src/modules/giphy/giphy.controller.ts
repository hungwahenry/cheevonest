import { Controller, Get, Query } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { GiphyService } from './giphy.service';
import { SearchGifsDto } from './dto/search-gifs.dto';

@Controller('giphy')
export class GiphyController {
  constructor(private readonly giphy: GiphyService) {}

  @Get('search')
  async search(
    @Query() dto: SearchGifsDto,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const query = dto.query?.trim() ?? '';
    const limit = dto.limit ?? 24;
    const offset = dto.offset ?? 0;

    return query === ''
      ? this.giphy.trending(limit, offset, user.id)
      : this.giphy.search(query, limit, offset, user.id);
  }
}
