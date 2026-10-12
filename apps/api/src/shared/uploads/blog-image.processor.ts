import { randomUUID } from 'crypto';
import { mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import {
  BLOG_IMAGE_OUTPUT_EXTENSION,
  BLOG_IMAGE_TARGET_HEIGHT,
  BLOG_IMAGE_TARGET_WIDTH,
  BLOG_IMAGE_WEBP_QUALITY,
} from './blog-image-upload.constants';
import { blogsUploadDir } from './blog-image-upload.multer';

export type BlogImageUploadResult = {
  filename: string;
  sizeBytes: number;
  format: 'webp';
  width: number;
  height: number;
};

function imageInput(file: Express.Multer.File): string | Buffer {
  if (file.buffer?.length) return file.buffer;
  if (file.path) return file.path;
  throw new Error('Uploaded blog image has no readable data.');
}

export async function processBlogImageUpload(
  file: Express.Multer.File,
): Promise<BlogImageUploadResult> {
  const dir = blogsUploadDir();
  mkdirSync(dir, { recursive: true });
  const filename = `blog-${Date.now()}-${randomUUID()}${BLOG_IMAGE_OUTPUT_EXTENSION}`;
  const outputPath = join(dir, filename);
  const result = await sharp(imageInput(file))
    .rotate()
    .resize(BLOG_IMAGE_TARGET_WIDTH, BLOG_IMAGE_TARGET_HEIGHT, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .webp({
      quality: BLOG_IMAGE_WEBP_QUALITY,
      effort: 5,
      smartSubsample: true,
      alphaQuality: 90,
    })
    .toFile(outputPath);
  if (file.path) {
    try {
      unlinkSync(file.path);
    } catch {
      /* ignore */
    }
  }
  return {
    filename,
    sizeBytes: result.size,
    format: 'webp',
    width: result.width,
    height: result.height,
  };
}
