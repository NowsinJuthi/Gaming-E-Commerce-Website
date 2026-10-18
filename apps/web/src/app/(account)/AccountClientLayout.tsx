"use client";
import { hasAuthSession } from "@/lib/access-token";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerPanelShell } from "@/components/customer/CustomerPanelShell";
import { canAccessLiveChat } from "@/lib/chat-access";
import { getCustomerPanelConfig } from "@/lib/api";
import { ensureShoppingSession, isEphemeralGuestSession } from "@/lib/guest-checkout";
import { guestPermissionsFromConfig } from "@/lib/guest-permissions";

const AUTH_REQUIRED_PREFIXES = [
  "/wallet",
  "/downloads",
  "/wishlist",
  "/referral",
  "/affiliate",
  "/rewards",
  "/support",
  "/notifications",
  "/profile",
  "/settings",
  "/reseller",
  "/dashboard",
  "/orders",
  "/checkout",
  "/cart",
  "/chat",
  "/tickets",
];

const GUEST_CHECKOUT_PREFIXES = ["/cart", "/checkout"];

export default function AccountClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const currentPath =
      pathname || (typeof window !== "undefined" ? window.location.pathname : "");
    const needsAuthNow = AUTH_REQUIRED_PREFIXES.some(
      (p) => currentPath === p || currentPath.startsWith(`${p}/`),
    );
    const isGuestCheckoutPath = GUEST_CHECKOUT_PREFIXES.some(
      (p) => currentPath === p || currentPath.startsWith(`${p}/`),
    );

    // For cart/checkout paths the session must be validated before the page
    // renders. Reset to "not ready" synchronously so the loading screen is
    // shown while gate() runs — this prevents the checkout page from rendering
    // with a stale/expired token when the user navigates from another page.
    if (needsAuthNow && isGuestCheckoutPath) {
      setReady(false);
    }

    async function gate() {
      const path = currentPath;
      const needsAuth = needsAuthNow;
      setRequireAuth(needsAuth);

      if (needsAuth) {
        const guestPath = isGuestCheckoutPath;
        if (guestPath) {
          // Always run ensureShoppingSession for cart/checkout paths even when
          // a token already exists — a stale banned guest token must be cleared
          // and replaced before the page tries to use it.
          const ok = await ensureShoppingSession();
          if (cancelled) return;
          if (ok) {
            setReady(true);
            return;
          }
          router.replace(`/login?next=${encodeURIComponent(path)}`);
          return;
        }

        const token = hasAuthSession();
        if (!token) {
          router.replace(`/login?next=${encodeURIComponent(path)}`);
          return;
        }
        // Ephemeral guest sessions must not access authenticated account areas.
        if (isEphemeralGuestSession()) {
          router.replace(`/login?next=${encodeURIComponent(path)}`);
          return;
        }
        // Ephemeral guest-chat tokens must not access /chat when the setting is off.
        if (path === "/chat" || path.startsWith("/chat/")) {
          try {
            const config = await getCustomerPanelConfig();
            if (
              !canAccessLiveChat(
                guestPermissionsFromConfig(config).guest_live_chat,
              )
            ) {
              router.replace(`/login?next=${encodeURIComponent(path)}`);
              return;
            }
          } catch {
            if (!canAccessLiveChat(false)) {
              router.replace(`/login?next=${encodeURIComponent(path)}`);
              return;
            }
          }
        }
      }

      if (!cancelled) setReady(true);
    }

    void gate();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="dashboard-loading">Loading…</p>
      </div>
    );
  }

  return (
    <CustomerPanelShell requireAuth={requireAuth}>{children}</CustomerPanelShell>
  );
}
