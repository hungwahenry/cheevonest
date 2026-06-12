import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import { TicketStatus } from '../../../../generated/prisma/client';

export class UpdateTicketDto {
  @ValidateIf((dto: UpdateTicketDto) => dto.name !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ValidateIf((dto: UpdateTicketDto) => dto.gross_price !== undefined)
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(100000000)
  gross_price?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(100000000)
  display_price?: number | null;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity?: number | null;

  @ValidateIf((dto: UpdateTicketDto) => dto.status !== undefined)
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsString()
  sales_starts_at?: string | null;

  @IsOptional()
  @IsString()
  sales_ends_at?: string | null;

  @IsOptional()
  @IsString()
  valid_from?: string | null;

  @IsOptional()
  @IsString()
  valid_to?: string | null;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  max_per_order?: number | null;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100000)
  max_per_user?: number | null;
}
