import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { UploadedFile } from '../../../../common/http/uploaded-file';
import {
  lowercaseTrim,
  toNumber,
} from '../../../../common/validation/transforms';
import { ORGANISATION_SLUG_PATTERN } from './check-slug.dto';
import { SocialEntryDto } from './create-organisation.dto';

export class UpdateOrganisationDto {
  @ValidateIf((dto: UpdateOrganisationDto) => dto.name !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ValidateIf((dto: UpdateOrganisationDto) => dto.slug !== undefined)
  @Transform(lowercaseTrim)
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(ORGANISATION_SLUG_PATTERN)
  slug?: string;

  @ValidateIf((dto: UpdateOrganisationDto) => dto.category_id !== undefined)
  @Transform(toNumber)
  @IsInt()
  category_id?: number;

  @ValidateIf((dto: UpdateOrganisationDto) => dto.about != null)
  @IsString()
  @MaxLength(600)
  @Allow()
  about?: string | null;

  @ValidateIf((dto: UpdateOrganisationDto) => dto.contact_email != null)
  @IsEmail()
  @MaxLength(255)
  @Allow()
  contact_email?: string | null;

  @ValidateIf((dto: UpdateOrganisationDto) => dto.contact_phone != null)
  @IsString()
  @MaxLength(30)
  @Allow()
  contact_phone?: string | null;

  @ValidateIf((dto: UpdateOrganisationDto) => dto.website != null)
  @IsUrl({ require_tld: false })
  @MaxLength(255)
  @Allow()
  website?: string | null;

  @ValidateIf((dto: UpdateOrganisationDto) => dto.city != null)
  @IsString()
  @MaxLength(60)
  @Allow()
  city?: string | null;

  @Allow()
  logo?: UploadedFile;

  @Allow()
  cover?: UploadedFile;

  @ValidateIf((dto: UpdateOrganisationDto) => dto.socials != null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialEntryDto)
  @Allow()
  socials?: SocialEntryDto[] | null;
}
