import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { assertRasterImageMagic, SHARP_INPUT_OPTIONS } from './image-magic';
import { mfsQrUploadDir } from './mfs-qr-upload.multer';

const QR_MAX_DIMENSION = 2048;

export async function processMfsQrImageUpload(
  file: Express.Multer.File,
): Promise<string> {
  const filename = `mfs-qr-${Date.now()}-${randomUUID()}.webp`;
  const outputPath = join(mfsQrUploadDir(), filename);
  assertRasterImageMagic(file);
  try {
    await sharp(file.path, SHARP_INPUT_OPTIONS)
      .rotate()
      .resize(QR_MAX_DIMENSION, QR_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 92, effort: 4 })
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
