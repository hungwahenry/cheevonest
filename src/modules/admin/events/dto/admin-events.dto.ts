import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { EventStatus } from '../../../../generated/prisma/client';

export class ListEventsDto {
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
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'past'])
  status?: EventStatus;
}

export class DeleteEventDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
