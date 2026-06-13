import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toNumber } from '../../../common/validation/transforms';

export class SearchGifsDto {
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
