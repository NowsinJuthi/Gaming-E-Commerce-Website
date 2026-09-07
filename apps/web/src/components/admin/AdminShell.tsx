"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminCenterToast } from "@/components/admin/AdminCenterToast";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Header } from "@/components/Header";
import { CustomerPanelShell } from "@/components/customer/CustomerPanelShell";
import { ApiError, clearTokens, getCustomerPanelConfig, getMe, getMyAdminPermissions, refreshSession } from "@/lib/api";
import { getCustomerDisplayName, getPrimaryRoleLabel } from "@/lib/admin-order-view";
import { hasAdminRole, hasBlogWorkspaceRole } from "@/lib/auth-roles";
import { mapAdminBlogPathToCustomer } from "@/lib/blog-workspace";
import { normalizeSiteAppearance } from "@/lib/site-appearance";
import { applyAdminFavicon } from "@/stores/admin-favicon-store";
import { useStaffChatAlerts } from "@/hooks/useStaffChatAlerts";
import { useLgScreen } from "@/hooks/useLgScreen";

function isCustomerBlogRoute(path: string): path is Route {
  return (
    path === "/dashboard/blogs" || path.startsWith("/dashboard/blogs/")
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [authState, setAuthState] = useState<"loading" | "ok" | "denied">(
    "loading",
  );
  const [denyReason, setDenyReason] = useState<"permission" | "error">(
    "permission",
  );
  const [denyDetail, setDenyDetail] = useState<string | null>(null);
  const [shellMode, setShellMode] = useState<"admin" | "customer-blog">("admin");
  const [name, setName] = useState("Admin");
  const [roleLabel, setRoleLabel] = useState("Admin");
  const authStateRef = useRef(authState);
  authStateRef.current = authState;
  const isLgScreen = useLgScreen();

  useStaffChatAlerts(authState === "ok" && shellMode === "admin");

  useEffect(() => {
    getCustomerPanelConfig()
      .then((config) => {
        applyAdminFavicon(
          normalizeSiteAppearance(config.appearance).adminFaviconUrl,
        );
      })
      .catch(() => {});
  }, []);

  // Run the auth check once on mount, and again only if the auth-change event
  // fires (another tab logged in/out) or the stored token disappears.
  // Do NOT put pathname/router in the dep array — re-running getMe() on every
  // page navigation is unnecessary and causes multi-tab token-rotation races
  // that can log the admin out unexpectedly.
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        const next = encodeURIComponent(pathname ?? "/admin");
        router.replace(`/login?next=${next}`);
        return;
      }
      try {
        const me = await getMe();
        if (cancelled) return;
        const perms = await getMyAdminPermissions();
        if (cancelled) return;

        if (perms.admin_panel_access || hasAdminRole(me.roles, token)) {
          setName(getCustomerDisplayName(me));
          setRoleLabel(getPrimaryRoleLabel(me.roles) ?? "Admin");
          setShellMode("admin");
          setAuthState("ok");
          return;
        }

        if (hasBlogWorkspaceRole(me.roles, token)) {
          const blogAccess =
            perms.view_blog_overview ||
            perms.view_blog_posts ||
            perms.create_edit_blog_posts;
          const currentPath = pathname ?? "";
          const onBlogRoute =
            currentPath.startsWith("/admin/blogs") ||
            currentPath.startsWith("/dashboard/blogs");
          if (blogAccess && onBlogRoute) {
            if (
              !perms.admin_panel_access &&
              !hasAdminRole(me.roles, token) &&
              currentPath.startsWith("/admin/blogs")
            ) {
              const customerPath = mapAdminBlogPathToCustomer(currentPath);
              if (customerPath && isCustomerBlogRoute(customerPath)) {
                router.replace(customerPath);
                return;
              }
            }
            setName(getCustomerDisplayName(me));
            setRoleLabel(getPrimaryRoleLabel(me.roles) ?? "Blogger");
            setShellMode(
              currentPath.startsWith("/dashboard/blogs")
                ? "customer-blog"
                : perms.admin_panel_access || hasAdminRole(me.roles, token)
                  ? "admin"
                  : "customer-blog",
            );
            setAuthState("ok");
            return;
          }
          if (blogAccess && (currentPath === "/admin" || currentPath === "/admin/")) {
            router.replace("/dashboard/blogs/overview");
            return;
          }
        }

        setDenyReason("permission");
        setDenyDetail(null);
        setAuthState("denied");
        return;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          const hasRefresh = !!localStorage.getItem("refreshToken");
          if (!hasRefresh) {
            clearTokens();
            const next = encodeURIComponent(pathname ?? "/admin");
            router.replace(`/login?next=${next}`);
            return;
          }
          const refreshed = await refreshSession();
          if (cancelled) return;
          if (refreshed) {
            return checkAuth();
          }
          if (!localStorage.getItem("refreshToken")) {
            clearTokens();
            const next = encodeURIComponent(pathname ?? "/admin");
            router.replace(`/login?next=${next}`);
          } else {
            setDenyReason("error");
            setDenyDetail(err.message);
            setAuthState("denied");
          }
          return;
        }
        if (err instanceof ApiError && err.status === 503) {
          // API restart or network blip — retry without logging out.
          window.setTimeout(() => {
            if (!cancelled) void checkAuth();
          }, 5000);
          return;
        }
        setDenyReason("error");
        setDenyDetail(
          err instanceof ApiError
            ? `${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Could not verify admin session.",
        );
        setAuthState("denied");
      }
    }

    void checkAuth();

    // Re-check when another tab logs in/out. Skip silent token refresh events
    // while already authenticated — they don't require a full getMe() round-trip.
    const onAuthChange = () => {
      const token = localStorage.getItem("accessToken");
      if (!token || authStateRef.current !== "ok") {
        void checkAuth();
      }
    };
    window.addEventListener("auth-change", onAuthChange);

    return () => {
      cancelled = true;
      window.removeEventListener("auth-change", onAuthChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (authState === "loading") {
  return (
    <div className="admin-panel admin-loading grid min-h-screen place-items-center">
      <p className="text-sm text-foreground-muted">Loading admin…</p>
    </div>
  );
  }

  if (authState === "denied") {
    return (
      <div className="grid min-h-screen place-items-center bg-surface px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            {denyReason === "error"
              ? "Could not verify your admin session. The API may be unreachable or misconfigured after deploy."
              : "Your account does not have admin access. Log in with an admin account to open the dashboard."}
          </p>
          {denyDetail ? (
            <p className="mt-3 rounded-lg border border-border bg-elevated px-4 py-3 text-left text-sm text-foreground-muted">
              {denyDetail}
            </p>
          ) : denyReason === "permission" ? (
            <p className="mt-3 rounded-lg border border-border bg-elevated px-4 py-3 text-left text-sm text-foreground-muted">
              On the server, run{" "}
              <code className="text-xs">corepack pnpm seed:users</code> for the
              default admin, or{" "}
              <code className="text-xs">
                node apps/api/scripts/promote-admin.cjs your@email.com
              </code>{" "}
              to grant admin to your account. Then log out and sign in again.
            </p>
          ) : null}
          {process.env.NODE_ENV === "development" ? (
            <p className="mt-3 rounded-lg border border-border bg-elevated px-4 py-3 text-left text-sm text-foreground-muted">
              Use your admin account credentials to sign in.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                clearTokens();
                router.replace("/login?next=%2Fadmin");
              }}
              className="btn-primary btn-primary-sm"
            >
              Log in as admin
            </button>
            <Link href="/" className="dashboard-pro-btn-ghost inline-flex">
              Back to store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (authState === "ok" && shellMode === "customer-blog") {
    return (
      <>
        <AdminCenterToast />
        <CustomerPanelShell requireAuth>{children}</CustomerPanelShell>
      </>
    );
  }

  return (
    <div className="admin-panel min-h-screen min-w-0 overflow-x-clip text-foreground">
      <AdminCenterToast />
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-x-0 bottom-0 top-14 z-30 bg-black/50 backdrop-blur-sm sm:top-16 lg:hidden"
        />
      ) : null}

      {/* Mobile header — hamburger opens the admin sidebar (< lg) */}
      {!isLgScreen ? (
        <Header onOpenMobileMenu={() => setOpen(true)} />
      ) : (
        <AdminTopbar
          pathname={pathname}
          adminName={name}
          adminRoleLabel={roleLabel}
          onOpenMenu={() => setOpen((value) => !value)}
        />
      )}

      <AdminSidebar open={open} onClose={() => setOpen(false)} />

      <div className="w-full min-w-0 pt-14 sm:pt-16 lg:pl-80">
        <main className="admin-main w-full min-w-0 max-w-none p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
