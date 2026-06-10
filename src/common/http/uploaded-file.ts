export interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  size: number;
}

export function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    Buffer.isBuffer((value as UploadedFile).buffer) &&
    typeof (value as UploadedFile).mimetype === 'string'
  );
}
