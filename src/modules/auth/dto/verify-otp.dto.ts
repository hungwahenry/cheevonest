import { Transform } from 'class-transformer';
import { IsEmail, Matches, MaxLength } from 'class-validator';
import { OTP_LENGTH } from '../otp.constants';
import { lowercaseTrim } from './send-otp.dto';

export class VerifyOtpDto {
  @Transform(lowercaseTrim)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @Matches(new RegExp(`^\\d{${OTP_LENGTH}}$`), {
    message: `The code must be ${OTP_LENGTH} digits.`,
  })
  code!: string;
}
