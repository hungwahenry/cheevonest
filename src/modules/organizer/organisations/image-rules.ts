import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { UploadedFile } from '../../../common/http/uploaded-file';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function assertValidImage(
  file: UploadedFile,
  field: string,
  maxKb: number,
): void {
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    throw new ValidationFailedException({
      [field]: [`The ${field} must be a file of type: jpeg, jpg, png, webp.`],
    });
  }

  if (file.size > maxKb * 1024) {
    throw new ValidationFailedException({
      [field]: [`The ${field} must not be greater than ${maxKb} kilobytes.`],
    });
  }
}
