import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { USERNAME_PATTERN } from '../../../../common/validation/patterns';
import { lowercaseTrim } from '../../../../common/validation/transforms';

export class CheckUsernameDto {
  @Transform(lowercaseTrim)
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(USERNAME_PATTERN)
  username!: string;
}
