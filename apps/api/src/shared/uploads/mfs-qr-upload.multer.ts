import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { createDiskUploadMulter, ensureUploadSubdir } from './disk-upload.multer';

export const MFS_QR_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

const MFS_QR_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MFS_QR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function mfsQrUploadDir(): string {
  return ensureUploadSubdir('mfs-qr');
}

export function validateMfsQrUploadFile(file: Express.Multer.File): void {
  const ext = extname(file.originalname).toLowerCase();
  if (!MFS_QR_EXTENSIONS.has(ext)) {
    throw new BadRequestException('QR image must be JPG, PNG, WebP, or GIF.');
  }
  if (!MFS_QR_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Unsupported QR image file type.');
  }
}

export const mfsQrUploadMulterOptions = createDiskUploadMulter({
  subdir: 'mfs-qr',
  maxBytes: MFS_QR_UPLOAD_MAX_BYTES,
  extensions: MFS_QR_EXTENSIONS,
  mimeTypes: MFS_QR_MIME_TYPES,
  tempPrefix: 'mfs-qr-temp',
});
