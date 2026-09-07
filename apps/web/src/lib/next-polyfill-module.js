/**
 * Minimal client polyfills for Next.js supported browsers (Chrome/Edge/Firefox 111+, Safari 16.4+).
 * Replaces next/dist/build/polyfills/polyfill-module to drop baseline features Lighthouse flags as legacy JS.
 */
if (!("canParse" in URL)) {
  URL.canParse = function canParse(url, base) {
    try {
      return !!new URL(url, base);
    } catch {
      return false;
    }
  };
}
