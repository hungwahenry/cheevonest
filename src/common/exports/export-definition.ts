export type ColumnFormat = 'text' | 'money' | 'integer';

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null;
  format?: ColumnFormat;
}

export interface ExportDefinition<T> {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: AsyncIterable<T>;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export const EXPORT_FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf'];

export interface RenderedExport {
  filename: string;
  contentType: string;
  body: Buffer;
}
