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
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="recaptcha/api.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("reCAPTCHA load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("reCAPTCHA load failed"));
    document.head.appendChild(script);
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
  return new Promise((resolve, reject) => {
    window.grecaptcha?.ready(() => {
      window.grecaptcha
        ?.execute(siteKey, { action })
        .then(resolve)
        .catch(reject);
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
