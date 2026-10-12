"use client";
import { hasAuthSession } from "@/lib/access-token";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AdminHeaderLogo } from "@/components/admin/AdminHeaderLogo";
import { AdminPublishControl } from "@/components/admin/AdminPublishControl";
import { SiteUserMenu } from "@/components/SiteUserMenu";
import {
  BellIcon,
  ChevronIcon,
  MenuIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/admin/icons";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useAdminHeaderRefresh } from "@/hooks/useAdminHeaderRefresh";
import { useCanAccessAdminPanel } from "@/hooks/useAdminPermissions";
import { getMe, logoutUser } from "@/lib/api";
import { searchNavLinks } from "@/lib/admin-nav";
import { resolveAvatarSrc } from "@/lib/site-appearance";

type Props = {
  pathname: string | null;
  adminName: string;
  adminRoleLabel?: string;
  onOpenMenu: () => void;
};

const iconBtn = "shell-icon-btn";

export function AdminTopbar({ pathname, adminName, adminRoleLabel = "Admin", onOpenMenu }: Props) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const userMobileRef = useRef<HTMLDivElement>(null);
  const userDesktopRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const unread = useUnreadNotifications(true, "staff", false, true);
  const [mounted, setMounted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { canAccessAdminPanel } = useCanAccessAdminPanel();
  const { refreshing, refresh } = useAdminHeaderRefresh();

  const results = searchNavLinks(query);

  function closeSearchPopup() {
    setSearchPopupOpen(false);
    setQuery("");
  }

  function openSearchPopup() {
    setUserOpen(false);
    setSearchPopupOpen(true);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function loadAvatar() {
      const token = hasAuthSession();
      if (!token) {
        setAvatarUrl(null);
        return;
      }
      getMe()
        .then((user) => setAvatarUrl(user.profile?.avatarUrl ?? null))
        .catch(() => setAvatarUrl(null));
    }

    loadAvatar();
    window.addEventListener("auth-change", loadAvatar);
    return () => window.removeEventListener("auth-change", loadAvatar);
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
    if (!searchPopupOpen) return;
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeSearchPopup();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [searchPopupOpen]);

  useEffect(() => {
    setUserOpen(false);
    setSearchPopupOpen(false);
    setQuery("");
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
            {adminName.charAt(0).toUpperCase()}
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
          {adminName}
        </span>
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-brand">
          {adminRoleLabel}
        </span>
      </span>
      <ChevronIcon
        className={`h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-200 ${
          userOpen ? "rotate-180" : ""
        }`}
      />
    </button>
  );

  const topbar = (
    <header className="site-header fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md">
      <div className="site-header-inner admin-topbar-inner grid h-14 w-full grid-cols-[auto_1fr_auto] items-center sm:h-16">
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
          {/* Publish — desktop admin topbar (mobile uses Header) */}
          <AdminPublishControl variant="labeled" />

          {/* Refresh — right of Publish */}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={iconBtn}
            aria-label="Refresh page"
          >
            <RefreshIcon
              className={`h-5 w-5${refreshing ? " animate-spin" : ""}`}
              aria-hidden
            />
          </button>

          <button
            type="button"
            onClick={openSearchPopup}
            className={iconBtn}
            aria-label="Search admin pages"
          >
            <SearchIcon className="h-5 w-5" />
          </button>

          <Link
            href="/admin/notifications"
            className={`${iconBtn} relative`}
            aria-label={
              unread > 0
                ? `Notifications, ${unread} unread`
                : "Notifications"
            }
          >
            <BellIcon className="h-5 w-5" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>

          {/* Mobile profile button — in right section so logo has room in left */}
          <div ref={userMobileRef} className="relative shrink-0 lg:hidden">
            {userMenuButton(true)}
            {userOpen ? (
              <SiteUserMenu
                className="absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-1.5rem))]"
                displayName={adminName}
                isAdmin={canAccessAdminPanel}
                accountMeta={adminRoleLabel}
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
                displayName={adminName}
                isAdmin={canAccessAdminPanel}
                accountMeta={adminRoleLabel}
                showStoreLink
                onClose={() => setUserOpen(false)}
                onLogout={() => void logout()}
              />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );

  const searchPopup =
    mounted && searchPopupOpen ? (
      <div className="admin-search-popup fixed inset-0 z-[100] flex items-start justify-center px-4 pt-20 sm:pt-24">
        <button
          type="button"
          aria-label="Close search"
          className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          onClick={closeSearchPopup}
        />
        <div className="admin-search-popup-panel relative z-10 w-full max-w-2xl">
          <div className="admin-search-popup-field relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Quick jump to page…"
              className="admin-search-popup-input w-full py-3.5 pl-12 pr-4 text-sm text-foreground outline-none"
            />
          </div>
          <div className="admin-search-dropdown mt-3 overflow-hidden rounded-2xl">
            {!query.trim() ? (
              <p className="px-4 py-4 text-sm text-foreground-muted">
                Type to find admin pages, settings, and tools.
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-4 text-sm text-foreground-muted">
                No pages found
              </p>
            ) : (
              <ul className="max-h-[min(24rem,50vh)] overflow-y-auto py-1">
                {results.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={{ pathname: r.href }}
                      onClick={closeSearchPopup}
                      className="flex flex-col gap-0.5 px-4 py-2.5 transition hover:bg-muted"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {r.label}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        {r.parent ? `${r.parent} · ` : ""}
                        {r.section}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      {topbar}
      {searchPopup ? createPortal(searchPopup, document.body) : null}
    </>
  );
}
