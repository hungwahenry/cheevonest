import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { lowercaseTrim } from '../../../../common/validation/transforms';

export class AddMemberDto {
  @Transform(lowercaseTrim)
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
