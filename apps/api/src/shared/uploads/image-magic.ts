import { BadRequestException } from '@nestjs/common';
import { closeSync, openSync, readSync } from 'fs';

export const SHARP_INPUT_OPTIONS = {
  failOn: 'warning' as const,
  limitInputPixels: 40_000_000,
};

function readPrefix(filePath: string, size = 16): Buffer {
  const fd = openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(size);
    const bytes = readSync(fd, buf, 0, size, 0);
    return buf.subarray(0, bytes);
  } finally {
    closeSync(fd);
  }
}

export function isRasterImageMagic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return true;
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return true;
  }
  const riff = buf.toString('ascii', 0, 4) === 'RIFF';
  const webp = buf.toString('ascii', 8, 12) === 'WEBP';
  return riff && webp;
}

export function assertRasterImageMagic(file: Express.Multer.File): void {
  const buf = file.buffer?.length
    ? file.buffer.subarray(0, 16)
    : file.path
      ? readPrefix(file.path)
      : Buffer.alloc(0);
  if (!isRasterImageMagic(buf)) {
    throw new BadRequestException('File is not a valid image.');
  }
}
