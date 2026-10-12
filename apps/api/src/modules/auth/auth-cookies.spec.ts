import {
  ACCESS_COOKIE_NAME,
  accessCookieOptions,
  isBrowserAuthRequest,
  omitSecretsFromBrowserSession,
  readNamedCookie,
  xssReadableSecrets,
} from './auth-cookies';

describe('HttpOnly access-cookie browser session', () => {
  it('sets the access cookie HttpOnly, Lax, and host-wide so Socket.IO receives it', () => {
    const opts = accessCookieOptions({ production: true, maxAgeSeconds: 900 });
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(900_000);
  });

  it('omits access and refresh tokens from the browser JSON body', () => {
    const body = omitSecretsFromBrowserSession({
      accessToken: 'aaa.bbb.ccc',
      refreshToken: 'refresh-secret',
      csrfToken: 'csrf-public',
      user: { id: 'u1' },
      expiresIn: 900,
    });
    expect(body).toEqual({
      csrfToken: 'csrf-public',
      user: { id: 'u1' },
      expiresIn: 900,
    });
    expect(JSON.stringify(body)).not.toMatch(/aaa\.bbb\.ccc|refresh-secret/);
  });

  it('parses the access cookie from the Cookie header', () => {
    expect(
      readNamedCookie(
        `${ACCESS_COOKIE_NAME}=aaa.bbb.ccc; other=1`,
        ACCESS_COOKIE_NAME,
      ),
    ).toBe('aaa.bbb.ccc');
  });

  it('treats Origin-bearing requests as browser sessions and omits JWTs', () => {
    expect(
      isBrowserAuthRequest({ origin: 'http://localhost:3000' }),
    ).toBe(true);
    expect(isBrowserAuthRequest({})).toBe(false);
    expect(
      isBrowserAuthRequest({ cookie: `${ACCESS_COOKIE_NAME}=aaa.bbb.ccc` }),
    ).toBe(true);
  });

  it('proves an XSS payload cannot read a usable access JWT', () => {
    const stolen = xssReadableSecrets({
      documentCookie: 'theme=dark; csrf=public-csrf',
      localStorage: {
        authSession: 'public-csrf',
        authMeta: JSON.stringify({ roles: ['customer'], isGuest: false }),
      },
      sessionStorage: {},
      windowGlobals: {
        __UNIQBD_GET_ACCESS_TOKEN: undefined,
      },
    });
    expect(stolen).toEqual([]);
  });

  it('would catch a regression that exposes a JWT on window or in JS storage', () => {
    const stolen = xssReadableSecrets({
      documentCookie: 'theme=dark',
      localStorage: { accessToken: 'aaa.bbb.ccc' },
      sessionStorage: {},
      windowGlobals: {
        __UNIQBD_GET_ACCESS_TOKEN: () => 'aaa.bbb.ccc',
      },
    });
    expect(stolen.length).toBeGreaterThan(0);
  });
});
