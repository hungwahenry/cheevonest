import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { REPORT_TARGET_TYPES } from '../services/reports.service';

export class CreateReportDto {
  @IsString()
  @IsIn(REPORT_TARGET_TYPES)
  target_type!: string;

  @IsString()
  @Length(26, 26)
  target_id!: string;

  @IsString()
  @Length(26, 26)
  report_reason_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string | null;
}

export class ListReasonsDto {
  @IsString()
  @IsIn(REPORT_TARGET_TYPES)
  target_type!: string;
}
