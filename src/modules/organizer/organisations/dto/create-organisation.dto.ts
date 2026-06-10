import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { UploadedFile } from '../../../../common/http/uploaded-file';
import {
  lowercaseTrim,
  toNumber,
} from '../../../../common/validation/transforms';
import { ORGANISATION_SLUG_PATTERN } from './check-slug.dto';

export class SocialEntryDto {
  @Transform(toNumber)
  @IsInt()
  platform_id!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  handle!: string;
}

export class CreateOrganisationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @Transform(lowercaseTrim)
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(ORGANISATION_SLUG_PATTERN)
  slug!: string;

  @Transform(toNumber)
  @IsInt()
  category_id!: number;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  about?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contact_email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contact_phone?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(255)
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string | null;

  @Allow()
  logo?: UploadedFile;

  @Allow()
  cover?: UploadedFile;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialEntryDto)
  socials?: SocialEntryDto[] | null;
}
