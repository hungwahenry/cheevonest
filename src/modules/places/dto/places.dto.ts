import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchPlacesDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  session_token?: string | null;
}

export class PlaceDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  session_token?: string | null;
}
