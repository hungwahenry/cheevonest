import { ValidationFailedException } from '../../common/exceptions/api.exception';
import { UploadedFile } from '../../common/http/uploaded-file';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_KB = 4096;

export function assertValidAvatar(file: UploadedFile): void {
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    throw new ValidationFailedException({
      avatar: ['The avatar must be a file of type: jpeg, jpg, png, webp.'],
    });
  }

  if (file.size > MAX_SIZE_KB * 1024) {
    throw new ValidationFailedException({
      avatar: [`The avatar must not be greater than ${MAX_SIZE_KB} kilobytes.`],
    });
  }
}
