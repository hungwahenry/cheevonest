import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlaceNotFoundException } from './exceptions/place-not-found.exception';
import { PlacesService } from './places.service';

class SearchPlacesDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  session_token?: string | null;
}

class PlaceDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  session_token?: string | null;
}

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get('search')
  async search(@Query() dto: SearchPlacesDto): Promise<unknown> {
    return this.places.search(dto.query, dto.session_token);
  }

  @Get(':placeId')
  async details(
    @Param('placeId') placeId: string,
    @Query() dto: PlaceDetailsDto,
  ): Promise<unknown> {
    const details = await this.places.details(placeId, dto.session_token);

    if (details === null) {
      throw new PlaceNotFoundException();
    }

    return details;
  }
}
