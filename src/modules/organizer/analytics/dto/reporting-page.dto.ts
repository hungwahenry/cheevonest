import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { OrderStatus } from '../../../../generated/prisma/client';

export class ReportingPageDto {
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
}
