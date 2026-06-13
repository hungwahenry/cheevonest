import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { toBoolean, toNumber } from '../../../../common/validation/transforms';

export class ModerationListDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  per_page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(toBoolean)
  flagged_only?: boolean;
}

export class FlagCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
