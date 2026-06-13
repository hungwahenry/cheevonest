import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { toBoolean, toNumber } from '../../../../common/validation/transforms';

export class ListOrganisationsDto {
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
  @Transform(toBoolean)
  suspended?: boolean;
}

export class SuspendOrganisationDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class ChangeOwnerDto {
  @IsString()
  @Length(26, 26)
  user_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}

export class DeleteOrganisationDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
