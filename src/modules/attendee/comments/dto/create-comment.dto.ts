import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';

export class GifDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;

  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url!: string;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(4096)
  width!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(4096)
  height!: number;
}

export class CreateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => GifDto)
  gif?: GifDto | null;

  @IsOptional()
  @IsString()
  parent_id?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  mentions?: string[] | null;
}
