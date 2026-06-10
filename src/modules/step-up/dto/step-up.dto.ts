import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateStepUpDto {
  @IsIn(['change_email', 'delete_account'])
  action!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class VerifyStepUpDto {
  @IsString()
  @Length(26, 26)
  factor_id!: string;

  @IsString()
  @MaxLength(12)
  code!: string;
}

export class ResendStepUpDto {
  @IsString()
  @Length(26, 26)
  factor_id!: string;
}
