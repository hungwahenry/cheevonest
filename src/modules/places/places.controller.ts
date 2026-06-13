import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlaceNotFoundException } from './exceptions/place-not-found.exception';
import { PlacesService } from './places.service';
import { PlaceDetailsDto, SearchPlacesDto } from './dto/places.dto';
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
