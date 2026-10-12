import { enumerationSafeRegisterResult } from './auth-register';

describe('register email enumeration', () => {
  it('returns the same success shape for an existing email as a new account', () => {
    const existing = enumerationSafeRegisterResult('Owner@Example.test');
    const created = enumerationSafeRegisterResult('owner@example.test');
    expect(existing).toEqual({
      requiresVerification: true,
      email: 'owner@example.test',
    });
    expect(created).toEqual(existing);
    expect(JSON.stringify(existing)).not.toMatch(/already registered/i);
  });
});
