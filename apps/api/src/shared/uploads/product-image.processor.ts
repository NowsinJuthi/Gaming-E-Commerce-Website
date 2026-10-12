import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { assertRasterImageMagic, SHARP_INPUT_OPTIONS } from './image-magic';
import { productsUploadDir } from './product-image-upload.multer';

const PRODUCT_MAX_DIMENSION = 1600;
const PRODUCT_WEBP_QUALITY = 85;

export async function processProductImageUpload(
  file: Express.Multer.File,
): Promise<string> {
  const filename = `product-${Date.now()}-${randomUUID()}.webp`;
  const outputPath = join(productsUploadDir(), filename);
  assertRasterImageMagic(file);
  await sharp(file.path, SHARP_INPUT_OPTIONS)
    .rotate()
    .resize(PRODUCT_MAX_DIMENSION, PRODUCT_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: PRODUCT_WEBP_QUALITY, effort: 4 })
    .toFile(outputPath);
  try {
    unlinkSync(file.path);
  } catch {
    /* ignore */
  }
  return filename;
}
