import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { BroadcastAudience } from '../../../../generated/prisma/client';

export class CreateBroadcastDto {
  @IsIn(['ticket_holders', 'rsvpers', 'both'])
  audience!: BroadcastAudience;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(5000)
  body_html!: string;
}

export class ListBroadcastsDto {
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
}
