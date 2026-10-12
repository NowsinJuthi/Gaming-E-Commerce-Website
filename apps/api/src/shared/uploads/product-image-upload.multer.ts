import { extname, join } from 'path';
import {
  PRODUCT_IMAGE_UPLOAD_EXTENSIONS,
  PRODUCT_IMAGE_UPLOAD_MAX_BYTES,
  PRODUCT_IMAGE_UPLOAD_MIME_TYPES,
} from './product-image-upload.constants';
import { createDiskUploadMulter, ensureUploadSubdir } from './disk-upload.multer';

export function productsUploadDir(): string {
  return ensureUploadSubdir('products');
}

export function validateProductImageUploadFile(file: Express.Multer.File): void {
  const ext = extname(file.originalname).toLowerCase();
  if (!PRODUCT_IMAGE_UPLOAD_EXTENSIONS.has(ext)) {
    throw new Error('invalid');
  }
}

export const productImageUploadMulterOptions = createDiskUploadMulter({
  subdir: 'products',
  maxBytes: PRODUCT_IMAGE_UPLOAD_MAX_BYTES,
  extensions: PRODUCT_IMAGE_UPLOAD_EXTENSIONS,
  mimeTypes: PRODUCT_IMAGE_UPLOAD_MIME_TYPES,
  tempPrefix: 'product-temp',
});

export function productUploadPath(filename: string): string {
  return join(productsUploadDir(), filename);
}
