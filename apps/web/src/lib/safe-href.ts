/**
 * Storefront menu links: site-relative paths or absolute http(s) URLs.
 * Protocol-relative `//host` values are rejected (they leave the origin).
 */
export function isSafeMenuHref(href: string | null | undefined): href is string {
  const value = href?.trim() ?? '';
  if (!value) return false;
  if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) {
    if (value.includes('://') || value.includes('\\')) return false;
    for (let i = 0; i < value.length; i += 1) {
      if ((value.charCodeAt(i) ?? 32) < 32) return false;
    }
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
