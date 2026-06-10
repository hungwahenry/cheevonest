import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { toNumber } from '../../../common/validation/transforms';

export class SearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
}
