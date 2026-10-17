"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BellIcon,
  GridIcon,
  HeartIcon,
  LogoutIcon,
  ReceiptIcon,
  StoreIcon,
  UserIcon,
} from "@/components/admin/icons";
import { ThemePreferenceIcon } from "@/components/theme/ThemeToggle";
import { resolveTheme } from "@/lib/theme";
import { useThemeStore } from "@/stores/theme-store";

type Props = {
  displayName: string;
  isAdmin: boolean;
  unread?: number;
  onClose: () => void;
  onLogout: () => void;
  className?: string;
  showStoreLink?: boolean;
  accountMeta?: string;
  variant?: "menu" | "drawer";
};

const DRAWER_ITEM_CLS =
  "flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-3 text-left text-sm font-bold text-foreground no-underline transition hover:bg-muted";

function ProfileMenuThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [animating, setAnimating] = useState(false);
  const resolved = hydrated ? resolveTheme(theme) : resolveTheme("system");
  const isDark = resolved === "dark" || resolved === "gaming" || resolved === "amoled";
  const display = isDark ? "dark" : "light";

  function toggleTheme() {
    setAnimating(true);
    setTheme(isDark ? "light" : "dark");
    window.setTimeout(() => setAnimating(false), 500);
  }

  return (
    <button
      type="button"
      className={`shell-icon-btn profile-theme-toggle${animating ? " profile-theme-toggle--active" : ""}`}
      aria-label={
        isDark ? "Dark mode. Tap to switch to light mode" : "Light mode. Tap to switch to dark mode"
      }
      onClick={toggleTheme}
    >
      <span key={display} className="profile-theme-toggle__icon" aria-hidden>
        <ThemePreferenceIcon preference={display} className="h-5 w-5 text-brand" />
      </span>
    </button>
  );
}

export function SiteUserMenu({
  displayName,
  isAdmin,
  unread = 0,
  onClose,
  onLogout,
  className = "",
  showStoreLink = false,
  accountMeta,
  variant = "menu",
}: Props) {
  const metaLabel = accountMeta ?? "Customer";

  if (variant === "drawer") {
    return (
      <div className={className}>
        {showStoreLink ? (
          <Link href="/" onClick={onClose} className={DRAWER_ITEM_CLS}>
            <StoreIcon className="h-4 w-4 shrink-0" />
            View storefront
          </Link>
        ) : null}

        <div className="space-y-1">
          <Link href="/profile" onClick={onClose} className={DRAWER_ITEM_CLS}>
            <UserIcon className="h-4 w-4 shrink-0" />
            Profile Settings
          </Link>
          <Link href="/orders" onClick={onClose} className={DRAWER_ITEM_CLS}>
            <ReceiptIcon className="h-4 w-4 shrink-0" />
            Orders
          </Link>
          <Link
            href="/notifications"
            onClick={onClose}
            className={DRAWER_ITEM_CLS}
          >
            <BellIcon className="h-4 w-4 shrink-0" />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span>Notifications</span>
              {unread > 0 ? (
                <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </span>
          </Link>
          <Link href="/wishlist" onClick={onClose} className={DRAWER_ITEM_CLS}>
            <HeartIcon className="h-4 w-4 shrink-0" />
            Wishlist
          </Link>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className={`${DRAWER_ITEM_CLS} mt-3 text-danger hover:bg-danger/10`}
        >
          <LogoutIcon className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className={`admin-user-menu${className ? ` ${className}` : ""}`}>
      <div className="admin-user-menu-header">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="admin-user-menu-name truncate">{displayName}</p>
            <p className="admin-user-menu-meta">{metaLabel}</p>
          </div>
          <ProfileMenuThemeToggle />
        </div>
      </div>

      <div className="admin-user-menu-body">
        {showStoreLink ? (
          <>
            <Link href="/" onClick={onClose} className="admin-user-menu-item">
              <span className="admin-user-menu-item-icon">
                <StoreIcon className="h-4 w-4 shrink-0" />
              </span>
              View storefront
            </Link>
            <div className="admin-user-menu-divider" aria-hidden />
          </>
        ) : null}
        <p className="admin-user-menu-label">Dashboards</p>
        <Link
          href="/dashboard"
          onClick={onClose}
          className="admin-user-menu-item"
        >
          <span className="admin-user-menu-item-icon">
            <UserIcon className="h-4 w-4 shrink-0" />
          </span>
          My Dashboard
        </Link>
        {isAdmin ? (
          <Link href="/admin" onClick={onClose} className="admin-user-menu-item">
            <span className="admin-user-menu-item-icon">
              <GridIcon className="h-4 w-4 shrink-0" />
            </span>
            Admin dashboard
          </Link>
        ) : null}

        <div className="admin-user-menu-divider" aria-hidden />

        <p className="admin-user-menu-label">Account</p>
        <Link href="/profile" onClick={onClose} className="admin-user-menu-item">
          <span className="admin-user-menu-item-icon">
            <UserIcon className="h-4 w-4 shrink-0" />
          </span>
          Profile Settings
        </Link>
        <Link href="/orders" onClick={onClose} className="admin-user-menu-item">
          <span className="admin-user-menu-item-icon">
            <ReceiptIcon className="h-4 w-4 shrink-0" />
          </span>
          Orders
        </Link>
        <Link
          href="/notifications"
          onClick={onClose}
          className="admin-user-menu-item"
        >
          <span className="admin-user-menu-item-icon">
            <BellIcon className="h-4 w-4 shrink-0" />
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span>Notifications</span>
            {unread > 0 ? (
              <span className="admin-user-menu-badge">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </span>
        </Link>
        <Link href="/wishlist" onClick={onClose} className="admin-user-menu-item">
          <span className="admin-user-menu-item-icon">
            <HeartIcon className="h-4 w-4 shrink-0" />
          </span>
          Wishlist
        </Link>

        <div className="admin-user-menu-divider" aria-hidden />

        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="admin-user-menu-item admin-user-menu-item--danger"
        >
          <span className="admin-user-menu-item-icon">
            <LogoutIcon className="h-4 w-4 shrink-0" />
          </span>
          Logout
        </button>
      </div>
    </div>
  );
}
