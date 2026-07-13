import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { PayoutStatus } from '../../../../generated/prisma/client';

const PAYOUT_STATUSES = [
  'requested',
  'approved',
  'processing',
  'paid',
  'rejected',
  'failed',
];

export class ListAdminPayoutsDto {
  @IsOptional()
  @IsIn(PAYOUT_STATUSES)
  status?: PayoutStatus;

  @IsOptional()
  @IsString()
  @Length(26, 26)
  organisation_id?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
}

