import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import {
  FAVICON_UPLOAD_EXTENSIONS,
  FAVICON_UPLOAD_MIME_TYPES,
  LOGO_UPLOAD_EXTENSIONS,
  LOGO_UPLOAD_MAX_BYTES,
  LOGO_UPLOAD_MIME_TYPES,
  type LogoUploadVariant,
} from './logo-upload.constants';
import { createDiskUploadMulter, ensureUploadSubdir } from './disk-upload.multer';

export function logosUploadDir(): string {
  return ensureUploadSubdir('logos');
}

export function validateLogoUploadFile(
  file: Express.Multer.File,
  variant: LogoUploadVariant,
): void {
  const ext = extname(file.originalname).toLowerCase();
  const isFavicon = variant === 'admin-favicon';
  const extensions = isFavicon ? FAVICON_UPLOAD_EXTENSIONS : LOGO_UPLOAD_EXTENSIONS;
  const mimeTypes = isFavicon ? FAVICON_UPLOAD_MIME_TYPES : LOGO_UPLOAD_MIME_TYPES;
  if (!extensions.has(ext)) {
    throw new BadRequestException(
      isFavicon
        ? 'Favicon must be ICO, WebP, GIF, PNG, or AVIF.'
        : 'Logo must be JPG, PNG, WebP, GIF, or AVIF.',
    );
  }
  if (!mimeTypes.has(file.mimetype)) {
    throw new BadRequestException('Unsupported logo file type.');
  }
}

export const logoUploadMulterOptions = createDiskUploadMulter({
  subdir: 'logos',
  maxBytes: LOGO_UPLOAD_MAX_BYTES,
  extensions: LOGO_UPLOAD_EXTENSIONS,
  mimeTypes: LOGO_UPLOAD_MIME_TYPES,
  tempPrefix: 'logo-temp',
});
