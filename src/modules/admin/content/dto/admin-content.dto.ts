import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertPageDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'The slug must be lowercase letters, numbers and hyphens.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200000)
  body_html?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  meta_description?: string | null;
}

export class UpdateWelcomeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  headline?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  subheadline?: string;
}
