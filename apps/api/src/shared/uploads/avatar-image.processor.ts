import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import {
  AVATAR_OUTPUT_SIZE_PX,
  AVATAR_OUTPUT_WEBP_QUALITY,
} from './avatar-upload.constants';
import { assertRasterImageMagic, SHARP_INPUT_OPTIONS } from './image-magic';
import { avatarsUploadDir } from './avatar-upload.multer';

export async function processAvatarUpload(
  file: Express.Multer.File,
): Promise<string> {
  const filename = `avatar-${Date.now()}-${randomUUID()}.webp`;
  const outputPath = join(avatarsUploadDir(), filename);
  assertRasterImageMagic(file);
  await sharp(file.path, SHARP_INPUT_OPTIONS)
    .rotate()
    .resize(AVATAR_OUTPUT_SIZE_PX, AVATAR_OUTPUT_SIZE_PX, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    })
    .webp({ quality: AVATAR_OUTPUT_WEBP_QUALITY, effort: 4 })
    .toFile(outputPath);
  try {
    unlinkSync(file.path);
  } catch {
    /* ignore */
  }
  return filename;
}
