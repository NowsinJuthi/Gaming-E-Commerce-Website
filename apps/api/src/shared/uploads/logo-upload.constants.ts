export const LOGO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const LOGO_UPLOAD_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.png',
  '.avif',
]);

export const LOGO_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/png',
  'image/avif',
]);

export const FAVICON_UPLOAD_EXTENSIONS = new Set([
  '.ico',
  ...LOGO_UPLOAD_EXTENSIONS,
]);

export const FAVICON_UPLOAD_MIME_TYPES = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  ...LOGO_UPLOAD_MIME_TYPES,
]);

export type LogoUploadVariant =
  | 'light'
  | 'dark'
  | 'admin'
  | 'email'
  | 'footer-light'
  | 'footer-dark'
  | 'admin-favicon';
