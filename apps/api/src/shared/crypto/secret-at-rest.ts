import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const SECRET_AT_REST_PREFIX = 'enc:v1:';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/** Parses a 32-byte AES key from standard base64. Returns undefined when unset. */
export function parseEncryptionKey(raw?: string | null): Buffer | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const key = Buffer.from(value, 'base64');
    if (key.length !== KEY_LENGTH) return undefined;
    return key;
  } catch {
    return undefined;
  }
}

export function hashSecretAtRest(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

/**
 * AES-256-GCM seal. Stored form is `enc:v1:` + base64(iv | tag | ciphertext).
 */
export function encryptSecretAtRest(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${SECRET_AT_REST_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
}

/**
 * Opens a sealed value, or returns legacy plaintext unchanged.
 * Prefixed ciphertext without a key is rejected so codes are never delivered encrypted.
 */
export function decryptSecretAtRest(
  stored: string,
  key?: Buffer,
): string {
  if (!stored.startsWith(SECRET_AT_REST_PREFIX)) {
    return stored;
  }
  if (!key) {
    throw new Error('Encrypted inventory value cannot be read without DATA_ENCRYPTION_KEY');
  }
  const packed = Buffer.from(stored.slice(SECRET_AT_REST_PREFIX.length), 'base64');
  if (packed.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted inventory value is truncated');
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  );
}

export function sealSecretAtRest(
  plaintext: string,
  key?: Buffer,
): { value: string; valueHash: string } {
  const valueHash = hashSecretAtRest(plaintext);
  return {
    value: key ? encryptSecretAtRest(plaintext, key) : plaintext,
    valueHash,
  };
}
