import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { toBoolean, toNumber } from '../../../../common/validation/transforms';

export class ListCommentsDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  per_page?: number;

  @IsOptional()
  @Transform(toBoolean)
  flagged_only?: boolean;

  @IsOptional()
  @IsString()
  @Length(26, 26)
  event_id?: string;
}

export class DeleteCommentDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
