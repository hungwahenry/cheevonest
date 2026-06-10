import { ValidationFailedException } from '../exceptions/api.exception';
import { UploadedFile } from '../http/uploaded-file';

const IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_TYPES_LABEL = 'jpeg, jpg, png, webp';

export function ensureValidImage(
  file: UploadedFile,
  field: string,
  maxKb: number,
): void {
  ensureValidFile(file, field, maxKb, IMAGE_MIMETYPES, IMAGE_TYPES_LABEL);
}

export function ensureValidFile(
  file: UploadedFile,
  field: string,
  maxKb: number,
  allowedMimetypes: string[],
  typesLabel: string,
): void {
  if (!allowedMimetypes.includes(file.mimetype)) {
    throw new ValidationFailedException({
      [field]: [`The ${field} must be a file of type: ${typesLabel}.`],
    });
  }

  if (file.size > maxKb * 1024) {
    throw new ValidationFailedException({
      [field]: [`The ${field} must not be greater than ${maxKb} kilobytes.`],
    });
  }
}
