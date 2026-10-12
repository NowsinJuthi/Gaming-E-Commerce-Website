import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  const crypto = new CryptoService();

  it('compares token hashes in constant time', () => {
    const hash = crypto.hashToken('123456');
    expect(crypto.equalHashes(hash, crypto.hashToken('123456'))).toBe(true);
    expect(crypto.equalHashes(hash, crypto.hashToken('000000'))).toBe(false);
  });

  it('generates zero-padded OTPs of the requested length', () => {
    const otp = crypto.generateOtp(6);
    expect(otp).toMatch(/^\d{6}$/);
  });
});
