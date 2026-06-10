import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export const lowercaseTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SendOtpDto {
  @Transform(lowercaseTrim)
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
