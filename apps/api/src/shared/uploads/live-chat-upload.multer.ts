import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import {
  LIVE_CHAT_UPLOAD_EXTENSIONS,
  LIVE_CHAT_UPLOAD_MAX_BYTES,
  LIVE_CHAT_UPLOAD_MIME_TYPES,
} from './live-chat-upload.constants';
import { resolveUploadsRoot } from './uploads-root';

function uploadsRoot(): string {
  return resolveUploadsRoot();
}

export function liveChatUploadDir(): string {
  return join(uploadsRoot(), 'live-chat');
}

export function validateLiveChatUploadFile(file: Express.Multer.File): void {
  const ext = extname(file.originalname).toLowerCase();
  if (!LIVE_CHAT_UPLOAD_EXTENSIONS.has(ext)) {
    throw new BadRequestException(
      'Chat image must be JPG, PNG, WebP, or GIF.',
    );
  }
  if (!LIVE_CHAT_UPLOAD_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Unsupported chat image file type.');
  }
}

export const liveChatUploadMulterOptions = {
  storage: diskStorage({
    destination: (req, _file, cb) => {
      const roomId = String(req.params?.id ?? '').trim();
      if (!/^[a-f0-9]{24}$/i.test(roomId)) {
        cb(new BadRequestException('Invalid room id'), '');
        return;
      }
      const dir = join(liveChatUploadDir(), roomId);
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      const safeExt = LIVE_CHAT_UPLOAD_EXTENSIONS.has(ext) ? ext : '.jpg';
      cb(null, `chat-${Date.now()}-${randomUUID()}${safeExt}`);
    },
  }),
  limits: { fileSize: LIVE_CHAT_UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    try {
      validateLiveChatUploadFile(file);
      cb(null, true);
    } catch (err) {
      cb(
        err instanceof Error ? err : new BadRequestException('Invalid file'),
        false,
      );
    }
  },
};
