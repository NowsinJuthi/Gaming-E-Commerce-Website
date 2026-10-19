import type { CustomerPanelConfig } from "@/lib/api";
import { API_BASE } from "@/lib/api";

export type GuestStorefrontPermissions = {
  guest_browse_storefront: boolean;
  guest_use_cart: boolean;
  guest_checkout: boolean;
  guest_live_chat: boolean;
  guest_view_media: boolean;
};

const DEFAULT_GUEST_PERMISSIONS: GuestStorefrontPermissions = {
  guest_browse_storefront: true,
  guest_use_cart: true,
  guest_checkout: false,
  guest_live_chat: false,
  guest_view_media: true,
};

/** Effective guest limits from panel config (Roles → Guest + checkout toggles). */
export function guestPermissionsFromConfig(
  config: Pick<CustomerPanelConfig, "checkout" | "guestPermissions">,
): GuestStorefrontPermissions {
  if (config.guestPermissions) {
    return config.guestPermissions;
  }
  return {
    ...DEFAULT_GUEST_PERMISSIONS,
    guest_checkout: config.checkout.allowGuestCheckout === true,
    guest_live_chat:
      config.checkout.allowGuestChat === true ||
      DEFAULT_GUEST_PERMISSIONS.guest_live_chat,
  };
}

/** Guest checkout is controlled only via Roles → Guest (`guest_checkout`). */
export function isGuestCheckoutEnabled(
  config: Pick<CustomerPanelConfig, "checkout" | "guestPermissions">,
): boolean {
  const p = guestPermissionsFromConfig(config);
  return p.guest_browse_storefront && p.guest_checkout;
}

export function isGuestCartEnabled(
  config: Pick<CustomerPanelConfig, "checkout" | "guestPermissions">,
): boolean {
  const p = guestPermissionsFromConfig(config);
  return p.guest_browse_storefront && p.guest_use_cart;
}

let guestPolicyCache: GuestStorefrontPermissions | null = null;
let guestPolicyInflight: Promise<GuestStorefrontPermissions | null> | null =
  null;

/** Authoritative guest limits from Roles → Guest (public API). */
export async function fetchGuestStorefrontPermissions(): Promise<GuestStorefrontPermissions | null> {
  if (guestPolicyCache) return guestPolicyCache;
  if (guestPolicyInflight) return guestPolicyInflight;

  guestPolicyInflight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/role-permissions/guest`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as GuestStorefrontPermissions;
      guestPolicyCache = data;
      return data;
    } catch {
      return null;
    } finally {
      guestPolicyInflight = null;
    }
  })();

  return guestPolicyInflight;
}

export function invalidateGuestStorefrontPolicyCache(): void {
  guestPolicyCache = null;
  guestPolicyInflight = null;
}

export async function resolveGuestStorefrontPermissions(
  config?: Pick<CustomerPanelConfig, "checkout" | "guestPermissions"> | null,
): Promise<GuestStorefrontPermissions> {
  const live = await fetchGuestStorefrontPermissions();
  if (live) return live;
  if (config) return guestPermissionsFromConfig(config);
  return DEFAULT_GUEST_PERMISSIONS;
}
