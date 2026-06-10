import { Transform } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { UploadedFile } from '../../../../common/http/uploaded-file';
import { toNumber } from '../../../../common/validation/transforms';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  starts_at?: string | null;

  @IsOptional()
  @IsString()
  ends_at?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  venue_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  place_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(255)
  video_url?: string | null;

  @Allow()
  flyer?: UploadedFile;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[] | null;
}
