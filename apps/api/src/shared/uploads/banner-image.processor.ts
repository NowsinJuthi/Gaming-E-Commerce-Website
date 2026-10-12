import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { assertRasterImageMagic, SHARP_INPUT_OPTIONS } from './image-magic';
import { bannersUploadDir } from './banner-upload.multer';

const BANNER_MAX_WIDTH = 2400;
const BANNER_MAX_HEIGHT = 1200;
const BANNER_WEBP_QUALITY = 85;

export async function processBannerImageUpload(
  file: Express.Multer.File,
): Promise<string> {
  const filename = `banner-${Date.now()}-${randomUUID()}.webp`;
  const outputPath = join(bannersUploadDir(), filename);
  assertRasterImageMagic(file);
  await sharp(file.path, SHARP_INPUT_OPTIONS)
    .rotate()
    .resize(BANNER_MAX_WIDTH, BANNER_MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: BANNER_WEBP_QUALITY, effort: 4 })
    .toFile(outputPath);
  try {
    unlinkSync(file.path);
  } catch {
    /* ignore */
  }
  return filename;
}
