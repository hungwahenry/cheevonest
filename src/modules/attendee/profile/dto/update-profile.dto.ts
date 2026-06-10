import { Transform } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { UploadedFile } from '../../../../common/http/uploaded-file';
import { USERNAME_PATTERN } from '../../../../common/validation/patterns';
import {
  lowercaseTrim,
  toBoolean,
  toNumber,
} from '../../../../common/validation/transforms';

export class UpdateProfileDto {
  @ValidateIf((dto: UpdateProfileDto) => dto.first_name !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name?: string;

  @ValidateIf((dto: UpdateProfileDto) => dto.last_name !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name?: string;

  @ValidateIf((dto: UpdateProfileDto) => dto.username !== undefined)
  @Transform(lowercaseTrim)
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(USERNAME_PATTERN)
  username?: string;

  @ValidateIf((dto: UpdateProfileDto) => dto.bio != null)
  @IsString()
  @MaxLength(500)
  @Allow()
  bio?: string | null;

  @ValidateIf((dto: UpdateProfileDto) => dto.latitude !== undefined)
  @Transform(toNumber)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ValidateIf((dto: UpdateProfileDto) => dto.longitude !== undefined)
  @Transform(toNumber)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ValidateIf((dto: UpdateProfileDto) => dto.place_name !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  place_name?: string;

  @ValidateIf((dto: UpdateProfileDto) => dto.city != null)
  @IsString()
  @MaxLength(120)
  @Allow()
  city?: string | null;

  @Allow()
  avatar?: UploadedFile;

  @ValidateIf((dto: UpdateProfileDto) => dto.remove_avatar !== undefined)
  @Transform(toBoolean)
  @IsBoolean()
  remove_avatar?: boolean;
}
