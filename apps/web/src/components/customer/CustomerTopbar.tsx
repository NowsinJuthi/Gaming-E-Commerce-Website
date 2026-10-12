"use client";
import { getSessionRoles, hasAuthSession } from "@/lib/access-token";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminHeaderLogo } from "@/components/admin/AdminHeaderLogo";
import { BellIcon, ChevronIcon, MenuIcon, SearchIcon } from "@/components/admin/icons";
import { SiteUserMenu } from "@/components/SiteUserMenu";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { getMe, logoutUser } from "@/lib/api";
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
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [displayName, setDisplayName] = useState("Account");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { canAccessAdminPanel } = useCanAccessAdminPanel();
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
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
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideUser = userMenuRef.current?.contains(target);
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

  const userMenuButton = () => (
    <button
      type="button"
      onClick={() => setUserOpen((o) => !o)}
      className="flex max-w-[9.5rem] items-center gap-1.5 rounded-xl border border-transparent py-1 pl-1 pr-1.5 transition hover:border-border hover:bg-muted/60 sm:max-w-none sm:gap-2 sm:pr-2"
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
      <span className="hidden max-w-[100px] truncate text-sm font-semibold text-foreground sm:inline">
        {displayName}
      </span>
      <ChevronIcon
        className={`hidden h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-200 sm:block ${
          userOpen ? "rotate-180" : ""
        }`}
      />
    </button>
  );

  return (
    <header className="site-header fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md">
      <div className="site-header-inner customer-topbar-inner grid h-14 w-full grid-cols-[auto_1fr_auto] items-center sm:h-16">
        {/* Left column: hamburger (all screens) + logo (desktop only) */}
        <div className="flex h-full min-w-0 shrink-0 items-center gap-1 px-2 sm:gap-1.5 sm:px-3 lg:w-80 lg:max-w-[20rem] lg:gap-2 lg:px-3">
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

          <div className="hidden lg:block">
            <AdminHeaderLogo />
          </div>
        </div>

        {/* Center column: logo centered on mobile/tablet, hidden on desktop */}
        <div className="flex min-w-0 items-center justify-center lg:hidden">
          <AdminHeaderLogo />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1 px-2 sm:gap-2 sm:px-3 lg:gap-3 lg:px-6">
          <Link href="/search" className={iconBtn} aria-label="Search products">
            <SearchIcon className="h-5 w-5" />
          </Link>

          {loggedIn ? (
            <Link
              href="/notifications"
              className={`${iconBtn} relative`}
              aria-label={
                unread > 0
                  ? `Notifications, ${unread} unread`
                  : "Notifications"
              }
            >
              <BellIcon className="h-5 w-5 text-[#f5b737]" />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}

          {loggedIn ? (
            <div ref={userMenuRef} className="relative shrink-0">
              {userMenuButton()}
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
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-semibold text-foreground hover:text-brand sm:inline"
              >
                Log in
              </Link>
              <Link href="/register" className="btn-primary btn-primary-sm hidden sm:inline-flex">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
