import { memoryStorage } from 'multer';

export const CATALOG_POSTER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const catalogPosterUploadMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: CATALOG_POSTER_UPLOAD_MAX_BYTES },
};
