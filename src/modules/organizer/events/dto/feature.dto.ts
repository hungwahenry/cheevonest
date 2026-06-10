import {
  Allow,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { UploadedFile } from '../../../../common/http/uploaded-file';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(255)
  link?: string | null;

  @IsOptional()
  @IsString()
  starts_at?: string | null;

  @IsOptional()
  @IsString()
  ends_at?: string | null;

  @Allow()
  image?: UploadedFile;
}

export class UpdateFeatureDto {
  @ValidateIf((dto: UpdateFeatureDto) => dto.title !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(255)
  link?: string | null;

  @IsOptional()
  @IsString()
  starts_at?: string | null;

  @IsOptional()
  @IsString()
  ends_at?: string | null;

  @Allow()
  image?: UploadedFile;
}
