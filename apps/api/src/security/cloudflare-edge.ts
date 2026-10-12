const headerValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * Cloudflare edge signal used only as defense-in-depth.
 *
 * `CF-Connecting-IP` is ignored: any client can spoof it when hitting origin
 * directly. Cloudflare always sets `CF-Ray`. Origin IP allowlisting in nginx
 * remains the real control against direct-to-origin traffic.
 */
export function hasCloudflareRay(
  headers: Record<string, string | string[] | undefined>,
): boolean {
  const ray = headerValue(headers['cf-ray'])?.trim();
  return Boolean(ray && /^[a-z0-9]+[-][a-z0-9]+$/i.test(ray));
}
