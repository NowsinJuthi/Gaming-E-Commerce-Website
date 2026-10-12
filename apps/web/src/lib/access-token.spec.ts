import {
  clearBrowserSession,
  getAccessToken,
  hasAuthSession,
  persistBrowserSession,
  xssWindowAccessTokenProbe,
} from "./access-token";

describe("browser access token is not readable by XSS", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      },
      configurable: true,
    });
  });

  it("never returns a JWT from JS after a cookie session is applied", () => {
    persistBrowserSession({
      csrfToken: "csrf-public",
      roles: ["customer"],
      expiresIn: 900,
    });
    expect(hasAuthSession()).toBe(true);
    expect(getAccessToken()).toBeNull();
    expect(xssWindowAccessTokenProbe()).toBeUndefined();
    expect(store.accessToken).toBeUndefined();
    expect(store.refreshToken).toBeUndefined();
    expect(JSON.stringify(store)).not.toMatch(
      /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    );
  });

  it("clears the CSRF session without leaving a stealable token", () => {
    persistBrowserSession({ csrfToken: "csrf-public" });
    clearBrowserSession();
    expect(hasAuthSession()).toBe(false);
    expect(getAccessToken()).toBeNull();
  });
});
