import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { IssuedTicketStatus } from '../../../../generated/prisma/client';

export class ListMyTicketsDto {
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
  @IsIn(['valid', 'scanned', 'revoked'])
  status?: IssuedTicketStatus;

  @IsOptional()
  @IsIn(['upcoming', 'past'])
  when?: 'upcoming' | 'past';
}
