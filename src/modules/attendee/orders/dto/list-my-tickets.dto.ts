import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { IssuedTicketStatus } from '../../../../generated/prisma/client';

// LEGACY(flat-tickets): DTO for the flat /attendee/tickets list. Delete this file
// with the route once a native build embeds the grouped-tickets bundle.
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
