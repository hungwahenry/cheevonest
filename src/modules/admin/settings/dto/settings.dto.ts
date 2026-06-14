import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toBoolean, toNumber } from '../../../../common/validation/transforms';

export class UpdateFeatureFlagDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(100)
  rollout_pct?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_public?: boolean;
}

export class UpdateSystemConfigDto {
  @IsOptional()
  value?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_public?: boolean;
}
