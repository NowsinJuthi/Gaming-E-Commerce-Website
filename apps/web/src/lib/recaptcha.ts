import { API_BASE } from "./api";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let siteKeyCache: string | null | undefined;
let scriptPromise: Promise<void> | null = null;

const RECAPTCHA_SCRIPT_HOSTS = [
  "https://www.recaptcha.net",
  "https://www.google.com",
];

function waitForGrecaptcha(maxMs = 10_000): Promise<void> {
  if (window.grecaptcha) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (window.grecaptcha) {
        resolve();
        return;
      }
      if (Date.now() - started >= maxMs) {
        reject(new Error("reCAPTCHA is unavailable — check network or ad blockers"));
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

async function fetchSiteKey(): Promise<string | null> {
  if (siteKeyCache !== undefined) return siteKeyCache;
  try {
    const res = await fetch(`${API_BASE}/security/recaptcha/site-key`, {
      cache: "no-store",
    });
    if (!res.ok) {
      siteKeyCache = null;
      return null;
    }
    const data = (await res.json()) as { enabled?: boolean; siteKey?: string };
    if (!data.enabled || !data.siteKey) {
      siteKeyCache = null;
      return null;
    }
    siteKeyCache = data.siteKey;
    return data.siteKey;
  } catch {
    siteKeyCache = null;
    return null;
  }
}

function loadScript(siteKey: string): Promise<void> {
  if (window.grecaptcha) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    'script[src*="recaptcha/api.js"]',
  );
  const existingKey = existing?.src.match(/[?&]render=([^&]+)/)?.[1];
  const decodedExistingKey = existingKey
    ? decodeURIComponent(existingKey)
    : null;
  if (existing && decodedExistingKey && decodedExistingKey !== siteKey) {
    existing.remove();
    scriptPromise = null;
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve();
      return;
    }
    const tag = document.querySelector<HTMLScriptElement>(
      'script[src*="recaptcha/api.js"]',
    );
    if (tag) {
      if (tag.dataset.recaptchaReady === "1" || window.grecaptcha) {
        resolve();
        return;
      }
      tag.addEventListener("load", () => {
        void waitForGrecaptcha().then(
          () => {
            tag.dataset.recaptchaReady = "1";
            resolve();
          },
          reject,
        );
      });
      tag.addEventListener("error", () =>
        reject(new Error("reCAPTCHA load failed")),
      );
      return;
    }
    let hostIndex = 0;

    const appendScript = () => {
      const host = RECAPTCHA_SCRIPT_HOSTS[hostIndex];
      if (!host) {
        reject(new Error("reCAPTCHA load failed"));
        return;
      }
      const script = document.createElement("script");
      script.src = `${host}/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        void waitForGrecaptcha().then(
          () => {
            script.dataset.recaptchaReady = "1";
            resolve();
          },
          reject,
        );
      };
      script.onerror = () => {
        script.remove();
        hostIndex += 1;
        appendScript();
      };
      document.head.appendChild(script);
    };

    appendScript();
  });
  return scriptPromise;
}

/** Returns a reCAPTCHA v3 token when configured; otherwise undefined. */
export async function getRecaptchaToken(
  action: string,
): Promise<string | undefined> {
  const siteKey = await fetchSiteKey();
  if (!siteKey) return undefined;
  await loadScript(siteKey);

  const RECAPTCHA_EXECUTE_MS = 20_000;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("reCAPTCHA timed out — disable ad blockers or try incognito"));
    }, RECAPTCHA_EXECUTE_MS);

    const finish = (fn: () => void) => {
      window.clearTimeout(timer);
      fn();
    };

    if (!window.grecaptcha) {
      finish(() =>
        reject(new Error("reCAPTCHA is unavailable — check network or ad blockers")),
      );
      return;
    }

    window.grecaptcha.ready(() => {
      if (!window.grecaptcha) {
        finish(() =>
          reject(new Error("reCAPTCHA is unavailable — check network or ad blockers")),
        );
        return;
      }
      window.grecaptcha
        .execute(siteKey, { action })
        .then((token) => finish(() => resolve(token)))
        .catch((err) =>
          finish(() =>
            reject(err instanceof Error ? err : new Error("reCAPTCHA failed")),
          ),
        );
    });
  });
}

/**
 * Pre-fetches the site key and loads the reCAPTCHA script in the background.
 * Call this when the user is about to perform an action requiring a token
 * so the heavy work is done before they click submit.
 */
export function warmupRecaptcha(): void {
  void fetchSiteKey().then((siteKey) => {
    if (siteKey) void loadScript(siteKey);
  });
}
