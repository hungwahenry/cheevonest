import { IsIn, IsOptional } from 'class-validator';
import { EXPORT_FORMATS } from '../../../../common/exports/export-definition';
import type { ExportFormat } from '../../../../common/exports/export-definition';

export class ExportQueryDto {
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;
}
