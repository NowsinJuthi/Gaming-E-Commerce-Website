import {
  decryptSecretAtRest,
  encryptSecretAtRest,
  hashSecretAtRest,
  parseEncryptionKey,
  sealSecretAtRest,
  SECRET_AT_REST_PREFIX,
} from './secret-at-rest';

describe('secret-at-rest', () => {
  const key = Buffer.alloc(32, 7);

  it('round-trips plaintext through AES-GCM', () => {
    const sealed = encryptSecretAtRest('GAME-CODE-1', key);
    expect(sealed.startsWith(SECRET_AT_REST_PREFIX)).toBe(true);
    expect(decryptSecretAtRest(sealed, key)).toBe('GAME-CODE-1');
  });

  it('does not store plaintext inside the ciphertext blob', () => {
    const sealed = encryptSecretAtRest('GAME-CODE-1', key);
    expect(sealed.includes('GAME-CODE-1')).toBe(false);
  });

  it('leaves legacy plaintext readable without a key', () => {
    expect(decryptSecretAtRest('legacy-code')).toBe('legacy-code');
  });

  it('refuses to open ciphertext when the key is missing', () => {
    const sealed = encryptSecretAtRest('secret', key);
    expect(() => decryptSecretAtRest(sealed)).toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it('hashes the same normalized value deterministically', () => {
    expect(hashSecretAtRest('abc')).toBe(hashSecretAtRest('abc'));
    expect(hashSecretAtRest('abc')).not.toBe(hashSecretAtRest('abd'));
  });

  it('stores plaintext when no key is configured (local dev)', () => {
    const sealed = sealSecretAtRest('plain-code');
    expect(sealed.value).toBe('plain-code');
    expect(sealed.valueHash).toBe(hashSecretAtRest('plain-code'));
  });

  it('rejects short encryption keys', () => {
    expect(parseEncryptionKey(Buffer.alloc(16).toString('base64'))).toBeUndefined();
    expect(parseEncryptionKey(key.toString('base64'))?.length).toBe(32);
  });
});
