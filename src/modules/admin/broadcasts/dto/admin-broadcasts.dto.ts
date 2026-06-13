import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';

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

  @IsOptional()
  @IsIn(['queued', 'sending', 'sent', 'failed', 'cancelled'])
  status?: string;
}

export class ListSuppressionsDto {
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
  @IsIn(['unsubscribed', 'bounced', 'complained'])
  reason?: string;
}
