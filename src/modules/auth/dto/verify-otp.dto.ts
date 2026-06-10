import { Transform } from 'class-transformer';
import { IsEmail, Matches, MaxLength } from 'class-validator';
import { lowercaseTrim } from './send-otp.dto';

const OTP_LENGTH = Number(process.env.OTP_LENGTH ?? 6);

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
