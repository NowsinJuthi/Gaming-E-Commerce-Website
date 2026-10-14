import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { diskStorage } from 'multer';

const UPLOAD_TMP = join(tmpdir(), 'uniqbd-smb-upload');
try {
  mkdirSync(UPLOAD_TMP, { recursive: true });
} catch {
  /* already exists */
}

/** Large video uploads go to temp disk, then stream to Samba via smbclient. */
export const SMB_VIDEO_UPLOAD_MAX_BYTES = 20 * 1024 * 1024 * 1024;
export const SMB_VIDEO_UPLOAD_MAX_FILES = 50;

export const smbVideoUploadMulterOptions = {
  storage: diskStorage({
    destination: UPLOAD_TMP,
    filename: (_req, file, cb) => {
      const safe = (file.originalname || 'video')
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(0, 120);
      cb(null, `${randomUUID()}-${safe || 'video'}`);
    },
  }),
  limits: {
    fileSize: SMB_VIDEO_UPLOAD_MAX_BYTES,
    files: SMB_VIDEO_UPLOAD_MAX_FILES,
  },
};
