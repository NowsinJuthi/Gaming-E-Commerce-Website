import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { resolveUploadsRoot } from './uploads-root';

export function ensureUploadSubdir(subdir: string): string {
  const dir = join(resolveUploadsRoot(), subdir);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function createDiskUploadMulter(options: {
  subdir: string;
  maxBytes: number;
  extensions: ReadonlySet<string>;
  mimeTypes: ReadonlySet<string>;
  tempPrefix: string;
  validate?: (file: Express.Multer.File) => void;
}) {
  const validate = (file: Express.Multer.File) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!options.extensions.has(ext)) {
      throw new BadRequestException('Unsupported file extension.');
    }
    if (!options.mimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type.');
    }
    options.validate?.(file);
  };

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        try {
          cb(null, ensureUploadSubdir(options.subdir));
        } catch (err) {
          cb(err as Error, '');
        }
      },
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const safeExt = options.extensions.has(ext) ? ext : '.jpg';
        cb(null, `${options.tempPrefix}-${Date.now()}-${randomUUID()}${safeExt}`);
      },
    }),
    limits: { fileSize: options.maxBytes, files: 1 },
    fileFilter: (
      _req: Express.Request,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      try {
        validate(file);
        cb(null, true);
      } catch (err) {
        cb(
          err instanceof Error ? err : new BadRequestException('Invalid file'),
          false,
        );
      }
    },
  };
}
