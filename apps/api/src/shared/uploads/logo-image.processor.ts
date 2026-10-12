import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { assertRasterImageMagic, SHARP_INPUT_OPTIONS } from './image-magic';
import type { LogoUploadVariant } from './logo-upload.constants';
import { logosUploadDir } from './logo-upload.multer';

const LOGO_MAX_DIMENSION = 2048;

export async function processLogoImageUpload(
  file: Express.Multer.File,
  variant: LogoUploadVariant,
): Promise<string> {
  const filename = `logo-${variant}-${Date.now()}-${randomUUID()}.webp`;
  const outputPath = join(logosUploadDir(), filename);
  assertRasterImageMagic(file);
  try {
    await sharp(file.path, SHARP_INPUT_OPTIONS)
      .rotate()
      .resize(LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90, effort: 4 })
      .toFile(outputPath);
    return filename;
  } finally {
    try {
      unlinkSync(file.path);
    } catch {
      /* ignore */
    }
  }
}
