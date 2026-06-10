import { Controller, Get, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toNumber } from '../../common/validation/transforms';
import type { User } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { GiphyService } from './giphy.service';

class SearchGifsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string | null;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(5000)
  offset?: number;
}

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
