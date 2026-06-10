import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';

export class ResolveBankAccountDto {
  @IsString()
  @MaxLength(16)
  bank_code!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(32)
  account_number!: string;
}

export class UpsertPayoutAccountDto extends ResolveBankAccountDto {}

export class RequestPayoutDto {
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  amount_minor!: number;
}

export class ListPayoutsDto {
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
}
