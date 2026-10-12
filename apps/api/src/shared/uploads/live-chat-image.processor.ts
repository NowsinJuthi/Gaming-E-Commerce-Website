import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import {
  LIVE_CHAT_MAX_HEIGHT,
  LIVE_CHAT_MAX_WIDTH,
  LIVE_CHAT_OUTPUT_WEBP_QUALITY,
} from './live-chat-upload.constants';
import { assertRasterImageMagic, SHARP_INPUT_OPTIONS } from './image-magic';
import { liveChatUploadDir } from './live-chat-upload.multer';

export async function processLiveChatImageUpload(
  file: Express.Multer.File,
  roomId: string,
): Promise<string> {
  const filename = `chat-${Date.now()}-${randomUUID()}.webp`;
  const outputPath = join(liveChatUploadDir(), roomId, filename);
  assertRasterImageMagic(file);
  await sharp(file.path, SHARP_INPUT_OPTIONS)
    .rotate()
    .resize(LIVE_CHAT_MAX_WIDTH, LIVE_CHAT_MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: LIVE_CHAT_OUTPUT_WEBP_QUALITY, effort: 4 })
    .toFile(outputPath);
  try {
    unlinkSync(file.path);
  } catch {
    /* ignore */
  }
  return `${roomId}/${filename}`;
}
