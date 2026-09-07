import type { LicenseFeatureKey } from "@/lib/api";

/** Admin routes gated by Amarpin license features. */
export const LICENSE_ADMIN_ROUTE_FEATURES: Partial<
  Record<string, LicenseFeatureKey>
> = {
  "/admin/settings/payments": "paymentGateway",
  "/admin/settings/email": "email",
  "/admin/settings/customer-panel": "api",
  "/admin/settings/delivery": "customOrder",
  "/admin/chat/settings": "liveChat",
};

export function licenseFeatureForPath(path: string): LicenseFeatureKey | null {
  const normalized = path.split("?")[0]?.replace(/\/$/, "") || path;
  if (LICENSE_ADMIN_ROUTE_FEATURES[normalized]) {
    return LICENSE_ADMIN_ROUTE_FEATURES[normalized] ?? null;
  }
  for (const [route, feature] of Object.entries(LICENSE_ADMIN_ROUTE_FEATURES)) {
    if (normalized.startsWith(`${route}/`)) {
      return feature ?? null;
    }
  }
  return null;
}

export function isLicenseRouteAllowed(
  path: string,
  features: Partial<Record<LicenseFeatureKey, boolean>> | undefined,
): boolean {
  const feature = licenseFeatureForPath(path);
  if (!feature) return true;
  if (features?.[feature] === true) return true;
  if (feature === "email" && features?.api === true) return true;
  return false;
}
