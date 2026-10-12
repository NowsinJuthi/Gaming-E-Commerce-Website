import { existsSync } from 'fs';
import { resolve } from 'path';

/** Resolves UPLOADS_DIR or the monorepo `uploads/` folder (never a URL). */
export function resolveUploadsRoot(): string {
  const fromEnv = process.env.UPLOADS_DIR?.trim();
  if (fromEnv) {
    if (/^https?:\/\//i.test(fromEnv)) {
      throw new Error('UPLOADS_DIR must be a filesystem path, not a URL');
    }
    return resolve(fromEnv);
  }

  const candidates = [
    resolve(process.cwd(), 'uploads'),
    resolve(process.cwd(), '../../uploads'),
    resolve(__dirname, '../../../../../uploads'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }
  return candidates[0]!;
}
