import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type { ReportStatus } from '../../../../generated/prisma/client';

export class ListReportsDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  per_page?: number;

  @IsOptional()
  @IsIn(['open', 'under_review', 'actioned', 'dismissed'])
  status?: ReportStatus;

  @IsOptional()
  @IsString()
  target_type?: string;
}

export class ActionReportDto {
  @IsIn(['delete_target', 'warn', 'no_action'])
  action!: string;

  @IsString()
  @MaxLength(1000)
  resolution_note!: string;
}

export class DismissReportDto {
  @IsString()
  @MaxLength(1000)
  note!: string;
}

export class BulkDismissReportsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Length(26, 26, { each: true })
  ids!: string[];

  @IsString()
  @MaxLength(1000)
  note!: string;
}
