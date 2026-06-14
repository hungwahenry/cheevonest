import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { toBoolean, toNumber } from '../../../../common/validation/transforms';

const SLUG = /^[a-z0-9-]+$/;

class CatalogItemBase {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(SLUG, {
    message: 'The slug must be lowercase letters, numbers and hyphens.',
  })
  slug?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_active?: boolean;
}

export class UpsertInterestDto extends CatalogItemBase {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class UpsertCategoryDto extends UpsertInterestDto {}

export class UpsertPlatformDto extends CatalogItemBase {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  base_url?: string | null;
}

export class UpsertReportReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(SLUG)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(['event', 'comment', 'user', 'organisation'], { each: true })
  scope_types?: string[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  requires_details?: boolean;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  display_order?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_active?: boolean;
}
