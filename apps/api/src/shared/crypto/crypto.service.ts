import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import {
  openDeliveredSecret,
  redactDeliveredSecret,
  sealDeliveredSecret,
  type DeliveredSecretFields,
} from './delivered-secrets';
import {
  decryptSecretAtRest,
  hashSecretAtRest,
  parseEncryptionKey,
  sealSecretAtRest,
} from './secret-at-rest';

const scrypt = promisify(scryptCallback) as unknown as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Centralised cryptographic helpers.
 * Uses Node's built-in scrypt for password hashing (no native dependency).
 */
@Injectable()
export class CryptoService {
  private readonly keyLength = 64;

  constructor(@Optional() private readonly config?: ConfigService) {}

  private dataEncryptionKey(): Buffer | undefined {
    return parseEncryptionKey(this.config?.get<string>('DATA_ENCRYPTION_KEY'));
  }

  /** Persist a gift code: ciphertext in production, plaintext in local dev without a key. */
  sealInventoryValue(plaintext: string): { value: string; valueHash: string } {
    return sealSecretAtRest(plaintext, this.dataEncryptionKey());
  }

  openInventoryValue(stored: string): string {
    return decryptSecretAtRest(stored, this.dataEncryptionKey());
  }

  inventoryValueHash(plaintext: string): string {
    return hashSecretAtRest(plaintext);
  }

  sealDeliveredSecret(plain: DeliveredSecretFields): DeliveredSecretFields {
    return sealDeliveredSecret(plain, this.dataEncryptionKey());
  }

  openDeliveredSecret(stored: DeliveredSecretFields): DeliveredSecretFields {
    return openDeliveredSecret(stored, this.dataEncryptionKey());
  }

  redactDeliveredSecret(): DeliveredSecretFields {
    return redactDeliveredSecret();
  }

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, this.keyLength);
    return `${salt}:${derived.toString('hex')}`;
  }

  async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, key] = stored.split(':');
    if (!salt || !key) {
      return false;
    }
    const derived = await scrypt(password, salt, this.keyLength);
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== derived.length) {
      return false;
    }
    return timingSafeEqual(keyBuffer, derived);
  }

  /** Deterministic hash for refresh tokens / OTP codes (for storage + lookup). */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  equalHashes(left: string, right: string): boolean {
    try {
      const a = Buffer.from(left);
      const b = Buffer.from(right);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /** Cryptographically strong, URL-safe opaque token. */
  generateToken(byteLength = 48): string {
    return randomBytes(byteLength).toString('base64url');
  }

  /** Numeric OTP code of the requested length (default 6 digits). */
  generateOtp(length = 6): string {
    const max = 10 ** length;
    return randomInt(0, max).toString().padStart(length, '0');
  }
}
