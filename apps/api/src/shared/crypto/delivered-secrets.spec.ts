import {
  openDeliveredSecret,
  redactDeliveredSecret,
  sealDeliveredSecret,
} from './delivered-secrets';
import { SECRET_AT_REST_PREFIX } from './secret-at-rest';

describe('delivered secrets', () => {
  const key = Buffer.alloc(32, 9);

  it('encrypts newly stored codes, serials, and PINs', () => {
    const sealed = sealDeliveredSecret(
      { code: 'GAME-1', serial: 'SN-1', pin: '9999' },
      key,
    );
    expect(sealed.code.startsWith(SECRET_AT_REST_PREFIX)).toBe(true);
    expect(sealed.serial?.startsWith(SECRET_AT_REST_PREFIX)).toBe(true);
    expect(sealed.pin?.startsWith(SECRET_AT_REST_PREFIX)).toBe(true);
    expect(sealed.code).not.toContain('GAME-1');
  });

  it('reads legacy plaintext without rewriting', () => {
    const opened = openDeliveredSecret(
      { code: 'PLAIN-CODE', serial: 'PLAIN-SN' },
      key,
    );
    expect(opened.code).toBe('PLAIN-CODE');
    expect(opened.serial).toBe('PLAIN-SN');
  });

  it('decrypts sealed values for the owner response', () => {
    const sealed = sealDeliveredSecret({ code: 'OWNER-CODE' }, key);
    expect(openDeliveredSecret(sealed, key).code).toBe('OWNER-CODE');
  });

  it('redacts codes for unauthorized staff', () => {
    expect(redactDeliveredSecret()).toEqual({ code: '••••' });
  });
});
