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
import type { IssuedTicketStatus } from '../../../../generated/prisma/client';

export class ListIssuedTicketsDto {
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
  @IsIn(['valid', 'scanned', 'revoked'])
  status?: IssuedTicketStatus;

  @IsOptional()
  @IsString()
  @Length(26, 26)
  event_id?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export class TransferTicketDto {
  @IsString()
  @Length(26, 26)
  to_user_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}
