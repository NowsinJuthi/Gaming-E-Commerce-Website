import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import {
  BLOG_IMAGE_UPLOAD_EXTENSIONS,
  BLOG_IMAGE_UPLOAD_MAX_BYTES,
  BLOG_IMAGE_UPLOAD_MIME_TYPES,
} from './blog-image-upload.constants';
import { createDiskUploadMulter, ensureUploadSubdir } from './disk-upload.multer';

export function blogsUploadDir(): string {
  return ensureUploadSubdir('blog');
}

export function validateBlogImageUploadFile(file: Express.Multer.File): void {
  const ext = extname(file.originalname).toLowerCase();
  if (!BLOG_IMAGE_UPLOAD_EXTENSIONS.has(ext)) {
    throw new BadRequestException(
      'Blog image must be JPG, PNG, WebP, GIF, or AVIF.',
    );
  }
  if (!BLOG_IMAGE_UPLOAD_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Unsupported blog image file type.');
  }
}

export const blogImageUploadMulterOptions = createDiskUploadMulter({
  subdir: 'blog',
  maxBytes: BLOG_IMAGE_UPLOAD_MAX_BYTES,
  extensions: BLOG_IMAGE_UPLOAD_EXTENSIONS,
  mimeTypes: BLOG_IMAGE_UPLOAD_MIME_TYPES,
  tempPrefix: 'blog-temp',
});
