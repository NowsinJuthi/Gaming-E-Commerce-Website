import {
  AVATAR_UPLOAD_EXTENSIONS,
  AVATAR_UPLOAD_MAX_BYTES,
  AVATAR_UPLOAD_MIME_TYPES,
} from './avatar-upload.constants';
import { createDiskUploadMulter, ensureUploadSubdir } from './disk-upload.multer';

export function avatarsUploadDir(): string {
  return ensureUploadSubdir('avatars');
}

export function validateAvatarUploadFile(file: Express.Multer.File): void {
  void file;
}

export const avatarUploadMulterOptions = createDiskUploadMulter({
  subdir: 'avatars',
  maxBytes: AVATAR_UPLOAD_MAX_BYTES,
  extensions: AVATAR_UPLOAD_EXTENSIONS,
  mimeTypes: AVATAR_UPLOAD_MIME_TYPES,
  tempPrefix: 'avatar-temp',
});
