import { accessTokenVersionMatches } from './access-token-version';

describe('access token version', () => {
  it('rejects an old access JWT after password change increments the version', () => {
    expect(accessTokenVersionMatches(0, 1)).toBe(false);
    expect(accessTokenVersionMatches(1, 1)).toBe(true);
    expect(accessTokenVersionMatches(undefined, undefined)).toBe(true);
    expect(accessTokenVersionMatches(undefined, 1)).toBe(false);
  });
});
