import {
  BANNER_UPLOAD_EXTENSIONS,
  BANNER_UPLOAD_MAX_BYTES,
  BANNER_UPLOAD_MIME_TYPES,
} from './banner-upload.constants';
import { createDiskUploadMulter, ensureUploadSubdir } from './disk-upload.multer';

export function bannersUploadDir(): string {
  return ensureUploadSubdir('banners');
}

export function validateBannerUploadFile(file: Express.Multer.File): void {
  void file;
}

export const bannerUploadMulterOptions = createDiskUploadMulter({
  subdir: 'banners',
  maxBytes: BANNER_UPLOAD_MAX_BYTES,
  extensions: BANNER_UPLOAD_EXTENSIONS,
  mimeTypes: BANNER_UPLOAD_MIME_TYPES,
  tempPrefix: 'banner-temp',
});
