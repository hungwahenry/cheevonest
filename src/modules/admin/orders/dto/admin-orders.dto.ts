import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { OrderStatus } from '../../../../generated/prisma/client';

export class ListOrdersDto {
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
  @IsIn(['pending', 'paid', 'cancelled', 'refunded'])
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @Length(26, 26)
  event_id?: string;
}

export class RefundOrderDto {
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  amount_minor!: number;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}
