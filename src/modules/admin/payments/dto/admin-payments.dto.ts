import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { PaymentStatus } from '../../../../generated/prisma/client';

export class ListPaymentsDto {
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
  @IsIn(['pending', 'successful', 'failed', 'abandoned', 'refunded'])
  status?: PaymentStatus;

  @IsOptional()
  @IsIn(['paystack', 'flutterwave'])
  provider?: string;
}
