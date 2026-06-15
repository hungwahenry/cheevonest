import { UploadedFile } from '../../../../common/http/uploaded-file';
import {
  ensureValidFile,
  ensureValidImage,
} from '../../../../common/validation/image.rules';

const FLYER_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
];
const FLYER_TYPES_LABEL = 'jpeg, jpg, png, webp, mp4, mov';
const FLYER_MAX_KB = 20480;
const FLYER_POSTER_MAX_KB = 4096;
const EVENT_IMAGE_MAX_KB = 8192;

export function ensureValidFlyer(file: UploadedFile): void {
  ensureValidFile(
    file,
    'flyer',
    FLYER_MAX_KB,
    FLYER_MIMETYPES,
    FLYER_TYPES_LABEL,
  );
}

export function ensureValidFlyerPoster(file: UploadedFile): void {
  ensureValidImage(file, 'flyer_poster', FLYER_POSTER_MAX_KB);
}

export function ensureValidEventImage(file: UploadedFile): void {
  ensureValidImage(file, 'image', EVENT_IMAGE_MAX_KB);
}

export function flyerTypeFor(file: UploadedFile): 'image' | 'video' {
  return file.mimetype.startsWith('video/') ? 'video' : 'image';
}
