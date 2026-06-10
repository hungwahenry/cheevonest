import { Transform } from 'class-transformer';
import {
  Allow,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { UploadedFile } from '../../../../common/http/uploaded-file';
import { USERNAME_PATTERN } from '../../../../common/validation/patterns';
import {
  lowercaseTrim,
  toBoolean,
  toIntArray,
  toNumber,
} from '../../../../common/validation/transforms';
import { UserGender } from '../../../../generated/prisma/client';

export class CompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name!: string;

  @Transform(lowercaseTrim)
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(USERNAME_PATTERN)
  username!: string;

  @IsEnum(UserGender)
  gender!: UserGender;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'The date of birth must be a valid date.',
  })
  date_of_birth!: string;

  @Transform(toNumber)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Transform(toNumber)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  place_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @Transform(toIntArray)
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  interests!: number[];

  @Allow()
  avatar?: UploadedFile;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptional()
  @IsString()
  referral_code?: string | null;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  marketing_opt_in?: boolean;
}
