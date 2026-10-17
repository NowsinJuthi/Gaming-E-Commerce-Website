"use client";
import { getSessionRoles, hasAuthSession } from "@/lib/access-token";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminHeaderLogo } from "@/components/admin/AdminHeaderLogo";
import { CartIcon, ChevronIcon, MenuIcon, SearchIcon } from "@/components/admin/icons";
import { SiteUserMenu } from "@/components/SiteUserMenu";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { getCart, getMe, logoutUser } from "@/lib/api";
import { useCanAccessAdminPanel } from "@/hooks/useAdminPermissions";
import {
  getCustomerDisplayName,
  getPrimaryRoleLabel,
} from "@/lib/admin-order-view";
import { resolveAvatarSrc } from "@/lib/site-appearance";

type Props = {
  pathname: string | null;
  onOpenMenu: () => void;
};

const iconBtn = "shell-icon-btn";

export function CustomerTopbar({ pathname, onOpenMenu }: Props) {
  const router = useRouter();
  const userMobileRef = useRef<HTMLDivElement>(null);
  const userDesktopRef = useRef<HTMLDivElement>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [displayName, setDisplayName] = useState("Account");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { canAccessAdminPanel } = useCanAccessAdminPanel();
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const unread = useUnreadNotifications(loggedIn, "customer", false, true);

  useEffect(() => {
    function loadUser() {
      setUserOpen(false);
      const token = hasAuthSession();
      setLoggedIn(!!token);
      if (!token) {
        setDisplayName("Account");
        setAvatarUrl(null);
        setRoleLabel(null);
        return;
      }
      setRoleLabel(getPrimaryRoleLabel(getSessionRoles()));
      getMe()
        .then((u) => {
          setDisplayName(getCustomerDisplayName(u));
          setAvatarUrl(u.profile?.avatarUrl ?? null);
          setRoleLabel(getPrimaryRoleLabel(u.roles));
        })
        .catch(() => {
          setDisplayName("Account");
          setAvatarUrl(null);
          setRoleLabel(getPrimaryRoleLabel(getSessionRoles()));
        });
    }

    loadUser();
    window.addEventListener("auth-change", loadUser);
    return () => window.removeEventListener("auth-change", loadUser);
  }, [pathname]);

  useEffect(() => {
    function refreshCart() {
      if (!hasAuthSession()) {
        setCartCount(0);
        return;
      }
      getCart()
        .then((c) =>
          setCartCount(c.items.reduce((sum, it) => sum + it.quantity, 0)),
        )
        .catch(() => setCartCount(0));
    }
    refreshCart();
    window.addEventListener("cart-change", refreshCart);
    window.addEventListener("auth-change", refreshCart);
    return () => {
      window.removeEventListener("cart-change", refreshCart);
      window.removeEventListener("auth-change", refreshCart);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideUser =
        userMobileRef.current?.contains(target) ||
        userDesktopRef.current?.contains(target);
      if (!insideUser) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    setUserOpen(false);
  }, [pathname]);

  async function logout() {
    await logoutUser();
    router.push("/login");
  }

  const userMenuButton = (showNameOnMobile: boolean) => (
    <button
      type="button"
      onClick={() => setUserOpen((o) => !o)}
      className={
        showNameOnMobile
          ? "flex max-w-[9.5rem] items-center gap-1.5 rounded-xl border border-transparent py-1 pl-1 pr-1.5 transition hover:border-border hover:bg-muted/60 lg:max-w-none lg:gap-2 lg:pr-2"
          : "flex items-center gap-2 rounded-xl border border-transparent py-1 pl-1 pr-2 transition hover:border-border hover:bg-muted/60"
      }
      aria-expanded={userOpen}
      aria-haspopup="menu"
    >
      <span className="admin-topbar-avatar overflow-hidden">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveAvatarSrc(avatarUrl)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full place-items-center text-sm font-bold">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span
        className={
          showNameOnMobile
            ? "flex min-w-0 max-w-[5.5rem] flex-col text-left sm:max-w-[6.5rem] lg:max-w-[7.5rem]"
            : "hidden min-w-0 max-w-[7.5rem] flex-col text-left lg:flex"
        }
      >
        <span className="truncate text-sm font-semibold text-foreground">
          {displayName}
        </span>
        {roleLabel ? (
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-brand">
            {roleLabel}
          </span>
        ) : null}
      </span>
      <ChevronIcon
        className={`h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-200 ${
          userOpen ? "rotate-180" : ""
        }`}
      />
    </button>
  );

  return (
    <header className="site-header isolate pointer-events-auto fixed top-0 left-0 right-0 z-[100] border-b">
      <div className="site-header-inner admin-topbar-inner grid h-14 w-full grid-cols-[auto_1fr_auto] items-center sm:h-16">
        <div className="col-start-1 row-start-1 flex h-full min-w-0 shrink-0 items-center gap-1 px-2 sm:gap-1.5 sm:px-3 lg:w-80 lg:max-w-[20rem] lg:gap-2 lg:px-3">
          <button
            type="button"
            onClick={() => {
              setUserOpen(false);
              onOpenMenu();
            }}
            className={`${iconBtn} -ml-0.5 lg:hidden`}
            aria-label="Open menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="site-header-brand-slot col-start-2 row-start-1 flex min-w-0 items-center justify-center self-center lg:col-start-1 lg:justify-start lg:pl-3">
          <AdminHeaderLogo />
        </div>

        <div className="col-start-3 row-start-1 flex min-w-0 items-center justify-end gap-1 px-2 sm:gap-2 sm:px-3 lg:gap-3 lg:px-6">
          <Link href="/search" className={iconBtn} aria-label="Search products">
            <SearchIcon className="h-5 w-5" />
          </Link>

          <Link href="/cart" className={`${iconBtn} relative`} aria-label="Cart">
            <CartIcon className="h-5 w-5" />
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            ) : null}
          </Link>

          {loggedIn ? (
            <>
              <div ref={userMobileRef} className="relative shrink-0 lg:hidden">
                {userMenuButton(true)}
                {userOpen ? (
                  <SiteUserMenu
                    className="absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-1.5rem))]"
                    displayName={displayName}
                    isAdmin={canAccessAdminPanel}
                    accountMeta={roleLabel ?? undefined}
                    unread={unread}
                    showStoreLink
                    onClose={() => setUserOpen(false)}
                    onLogout={() => void logout()}
                  />
                ) : null}
              </div>

              <div ref={userDesktopRef} className="relative hidden shrink-0 lg:block">
                {userMenuButton(false)}
                {userOpen ? (
                  <SiteUserMenu
                    className="absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-1.5rem))]"
                    displayName={displayName}
                    isAdmin={canAccessAdminPanel}
                    accountMeta={roleLabel ?? undefined}
                    unread={unread}
                    showStoreLink
                    onClose={() => setUserOpen(false)}
                    onLogout={() => void logout()}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-semibold text-foreground hover:text-brand sm:inline"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="btn-primary btn-primary-sm hidden sm:inline-flex"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
