import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { lowercaseTrim } from '../../../../common/validation/transforms';

export const ORGANISATION_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]+$/;

export class CheckSlugDto {
  @Transform(lowercaseTrim)
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(ORGANISATION_SLUG_PATTERN)
  slug!: string;
}
