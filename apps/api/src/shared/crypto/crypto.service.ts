import { Injectable } from '@nestjs/common';
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

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

  /** Cryptographically strong, URL-safe opaque token. */
  generateToken(byteLength = 48): string {
    return randomBytes(byteLength).toString('base64url');
  }

  /** Numeric OTP code of the requested length (default 6 digits). */
  generateOtp(length = 6): string {
    const max = 10 ** length;
    const value = parseInt(randomBytes(4).toString('hex'), 16) % max;
    return value.toString().padStart(length, '0');
  }
}
