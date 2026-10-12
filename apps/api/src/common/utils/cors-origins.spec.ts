import {
  isAllowedCorsOrigin,
  parseCorsOrigins,
} from './cors-origins';

describe('parseCorsOrigins', () => {
  it('accepts exact https origins', () => {
    const allowed = parseCorsOrigins(
      'https://uniqbd.com, https://www.uniqbd.com',
    );
    expect(allowed.has('https://uniqbd.com')).toBe(true);
    expect(allowed.has('https://www.uniqbd.com')).toBe(true);
  });

  it('rejects extra path as a different origin identity after URL parse', () => {
    const allowed = parseCorsOrigins('https://uniqbd.com');
    expect(isAllowedCorsOrigin('https://uniqbd.com', allowed)).toBe(true);
    expect(isAllowedCorsOrigin('https://uniqbd.com.evil.test', allowed)).toBe(
      false,
    );
    expect(isAllowedCorsOrigin('https://eviluniqbd.com', allowed)).toBe(false);
    expect(isAllowedCorsOrigin('null', allowed)).toBe(false);
  });

  it('allows missing origin for non-browser clients', () => {
    const allowed = parseCorsOrigins('https://uniqbd.com');
    expect(isAllowedCorsOrigin(undefined, allowed)).toBe(true);
  });
});
