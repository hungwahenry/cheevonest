import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { toBoolean, toNumber } from '../../../../common/validation/transforms';

export class ListUsersDto {
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

  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: string;
}

export class SuspendUserDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
