"use client";
import { getSessionRoles, hasAuthSession } from "@/lib/access-token";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { getCart, getMe, logoutUser } from "@/lib/api";
import { useCanAccessAdminPanel } from "@/hooks/useAdminPermissions";
import { getPrimaryRoleLabel } from "@/lib/admin-order-view";
import {
  isGuestCheckoutSession,
  isRegisteredUserLoggedIn,
} from "@/lib/guest-checkout";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useAdminHeaderRefresh } from "@/hooks/useAdminHeaderRefresh";
import { resolveAvatarSrc } from "@/lib/site-appearance";
import { useThemeStore } from "@/stores/theme-store";
import { ProductSearchAutocomplete } from "@/components/search/ProductSearchAutocomplete";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { SiteLogo } from "@/components/SiteLogo";
import { AdminHeaderLogo } from "@/components/admin/AdminHeaderLogo";
import { AdminPublishControl } from "@/components/admin/AdminPublishControl";
import { SiteUserMenu } from "@/components/SiteUserMenu";
import { ThemePreferenceIcon } from "@/components/theme/ThemeToggle";
import { useSiteMenus } from "@/components/SiteMenusProvider";
import {
  ChevronIcon,
  ChatIcon,
  GridIcon,
  RefreshIcon,
  StoreIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  isHeaderOthersMenuActive,
  isSiteMenuLinkActive,
  splitStorefrontHeaderNav,
  type SiteMenuLink,
} from "@/lib/site-menus";
import { hardNavigateFromMediaCatalog } from "@/lib/storefront-nav";
import { StorefrontHeaderNav } from "@/components/nav/StorefrontHeaderNav";

const iconBtn = "shell-icon-btn";

// Runs synchronously before first browser paint on client; falls back to
// useEffect on server (where window doesn't exist) to avoid SSR warnings.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function siteMenuIcon(href: string) {
  const path = href.split("?")[0] ?? href;
  const query = href.includes("?") ? href.split("?")[1] ?? "" : "";
  const params = new URLSearchParams(query);
  const type = params.get("type");

  if (path === "/") return GridIcon;
  if (path === "/products" && type === "topup") return ZapIcon;
  if (path === "/products") return StoreIcon;
  if (path === "/support") return ChatIcon;
  if (path === "/request-product") return StoreIcon;
  if (path === "/blog") return GridIcon;
  if (path === "/reviews") return StoreIcon;
  if (path === "/website") return GridIcon;
  return StoreIcon;
}

function MobileNavOthers({
  items,
  pathname,
  typeParam,
  onClose,
}: {
  items: SiteMenuLink[];
  pathname: string;
  typeParam: string | null;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = isHeaderOthersMenuActive(items, pathname, typeParam);

  if (items.length === 0) return null;

  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`admin-nav-link w-full ${active ? "admin-nav-link-active" : ""}`}
        aria-expanded={open}
      >
        {active ? <span className="admin-nav-indicator" aria-hidden /> : null}
        <span className={`admin-nav-icon-box ${active ? "admin-nav-icon-box-active" : ""}`}>
          <GridIcon className="h-4 w-4" />
        </span>
        <span className="flex-1 truncate text-left">Others</span>
        <ChevronIcon
          className={`h-4 w-4 shrink-0 transition-transform duration-200${open ? " rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul className="site-mobile-submenu mt-1 flex flex-col gap-1 pl-2">
          {items.map((item) => {
            const itemActive = isSiteMenuLinkActive(item.href, pathname, typeParam);
            const Icon = siteMenuIcon(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href as "/"}
                  onClick={(event) => {
                    onClose();
                    hardNavigateFromMediaCatalog(pathname, item.href, event);
                  }}
                  className={`admin-nav-link ${itemActive ? "admin-nav-link-active" : ""}`}
                >
                  {itemActive ? <span className="admin-nav-indicator" aria-hidden /> : null}
                  <span
                    className={`admin-nav-icon-box ${itemActive ? "admin-nav-icon-box-active" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

function MobileNavItems({
  navItems,
  headerOthers,
  pathname,
  onClose,
}: {
  navItems: SiteMenuLink[];
  headerOthers: SiteMenuLink[];
  pathname: string;
  onClose: () => void;
}) {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const { primary } = splitStorefrontHeaderNav(navItems, headerOthers);
  return (
    <>
      {primary.map((item) => {
        const active = isSiteMenuLinkActive(item.href, pathname, typeParam);
        const Icon = siteMenuIcon(item.href);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href as "/"}
              onClick={(event) => {
                onClose();
                hardNavigateFromMediaCatalog(pathname, item.href, event);
              }}
              className={`admin-nav-link ${active ? "admin-nav-link-active" : ""}`}
            >
              {active ? <span className="admin-nav-indicator" aria-hidden /> : null}
              <span className={`admin-nav-icon-box ${active ? "admin-nav-icon-box-active" : ""}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
}

function MobileNavItemsFallback({
  navItems,
  headerOthers,
  onClose,
}: {
  navItems: SiteMenuLink[];
  headerOthers: SiteMenuLink[];
  onClose: () => void;
}) {
  const pathname = usePathname() ?? "";
  const { primary } = splitStorefrontHeaderNav(navItems, headerOthers);
  return (
    <>
      {primary.map((item) => {
        const Icon = siteMenuIcon(item.href);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href as "/"}
              onClick={(event) => {
                onClose();
                hardNavigateFromMediaCatalog(pathname, item.href, event);
              }}
              className="admin-nav-link"
            >
              <span className="admin-nav-icon-box">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
}

export function Header({
  onOpenMobileMenu,
}: {
  /** When provided, clicking the hamburger calls this instead of opening the
   *  built-in site-nav drawer. Used by AdminShell / CustomerPanelShell so the
   *  hamburger opens the correct sidebar for that context. */
  onOpenMobileMenu?: () => void;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loggedIn, setLoggedIn] = useState(false);
  const { canAccessAdminPanel } = useCanAccessAdminPanel();
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("UniQbd");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  // Admin users get staff notifications; regular users get customer notifications
  const unread = useUnreadNotifications(
    loggedIn,
    canAccessAdminPanel ? "staff" : "customer",
    false,
    true,
  );
  const [term, setTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerPortaled, setHeaderPortaled] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const { refreshing: adminRefreshing, refresh: refreshAdminPage } =
    useAdminHeaderRefresh();
  const userMobileRef = useRef<HTMLDivElement>(null);
  const userDesktopRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const setTheme = useThemeStore((s) => s.setTheme);
  const siteMenus = useSiteMenus();
  const navItems = siteMenus.header;
  const headerOthers = siteMenus.headerOthers;
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  /** Panel shells embed the header (< lg only). Do not portal or it ignores parent `lg:hidden`. */
  const shellEmbedded = Boolean(onOpenMobileMenu);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setMenuOpen(false);
    setSearchOpen(false);
    router.push(
      `/search${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`,
    );
  }

  // useIsomorphicLayoutEffect fires synchronously before the first browser
  // paint so the logged-in state is correct from the very first render.
  useIsomorphicLayoutEffect(() => {
    const sync = () => {
      const token = hasAuthSession();
      const registered = isRegisteredUserLoggedIn();
      setLoggedIn(registered);
      if (!token || isGuestCheckoutSession()) {
        if (!registered) {
          setDisplayName("UniQbd");
          setAvatarUrl(null);
          setRoleLabel(null);
        }
        if (!token) return;
      }
      if (!registered) return;
      setRoleLabel(getPrimaryRoleLabel(getSessionRoles()));
      getMe()
        .then((u) => {
          const name =
            u.profile?.displayName ||
            [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") ||
            u.email.split("@")[0];
          setDisplayName(name || "UniQbd");
          setAvatarUrl(u.profile?.avatarUrl ?? null);
          setRoleLabel(getPrimaryRoleLabel(u.roles));
        })
        .catch(() => {
          setDisplayName("UniQbd");
          setRoleLabel(getPrimaryRoleLabel(getSessionRoles()));
        });
    };
    sync();
    window.addEventListener("auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (!hasAuthSession()) {
        setCartCount(0);
        return;
      }
      getCart()
        .then((c) =>
          setCartCount(c.items.reduce((sum, it) => sum + it.quantity, 0)),
        )
        .catch(() => setCartCount(0));
    };
    refresh();
    window.addEventListener("cart-change", refresh);
    window.addEventListener("auth-change", refresh);
    return () => {
      window.removeEventListener("cart-change", refresh);
      window.removeEventListener("auth-change", refresh);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useIsomorphicLayoutEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    setHeaderPortaled(true);
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

  async function logout() {
    setMenuOpen(false);
    setUserOpen(false);
    await logoutUser();
    router.push("/");
  }

  // Show a neutral circle icon until Zustand store hydrates from localStorage
  // to prevent a sun↔moon flash on first render.
  const themeToggleIcon = themeHydrated ? (
    <ThemePreferenceIcon preference={theme === "dark" ? "light" : "dark"} />
  ) : (
    <svg className="h-5 w-5 opacity-0" viewBox="0 0 24 24" aria-hidden />
  );

  const headerBrand = isAdminRoute ? (
    <AdminHeaderLogo />
  ) : (
    <SiteLogo
      href="/"
      onLinkClick={(event) => {
        hardNavigateFromMediaCatalog(pathname ?? "", "/", event);
      }}
    />
  );

  const AvatarInner = () => (
    <span className="site-header-profile-ring">
      <span className="site-header-profile-ringOrbit" aria-hidden />
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
    </span>
  );

  const headerChrome = (
    <>
      <header
        className={`site-header pointer-events-auto fixed top-0 left-0 right-0 z-[10000] border-b${shellEmbedded ? " site-header--shell-embedded" : ""}${!isAdminRoute ? " site-header--storefront" : ""}`}
      >
        <div
          className={`site-header-inner grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:h-16 lg:gap-3 ${HOME_CONTAINER_CLS}`}
        >
          {/* ── Left column ────────────────────────────────────────────── */}
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1 justify-self-start sm:gap-2">
            {/* Mobile nav (+ storefront search) — admin: menu, refresh; no search */}
            <button
              type="button"
              onClick={() => {
                setUserOpen(false);
                if (onOpenMobileMenu) {
                  onOpenMobileMenu();
                } else {
                  setMenuOpen((open) => !open);
                }
              }}
              className={`${iconBtn} lg:hidden`}
              aria-label="Open menu"
              aria-expanded={onOpenMobileMenu ? undefined : menuOpen}
            >
              <MenuIcon />
            </button>

            {isAdminRoute ? (
              <button
                type="button"
                onClick={refreshAdminPage}
                disabled={adminRefreshing}
                className={`${iconBtn} lg:hidden`}
                aria-label="Refresh page"
              >
                <RefreshIcon
                  className={`h-5 w-5${adminRefreshing ? " animate-spin" : ""}`}
                  aria-hidden
                />
              </button>
            ) : null}
            {!isAdminRoute ? (
              <button
                type="button"
                onClick={() => setSearchOpen((o) => !o)}
                className={`${iconBtn} lg:hidden`}
                aria-label="Search"
              >
                <SearchIcon />
              </button>
            ) : null}
          </div>

          {/* Single logo: centered below lg, left column on desktop */}
          <div className="site-header-brand-slot col-start-2 row-start-1 flex min-w-0 shrink-0 items-center justify-center self-center lg:col-start-1 lg:justify-start [&_.site-logo-img]:max-w-[180px] lg:[&_.site-logo-img]:h-10 lg:[&_.site-logo-img]:max-w-[9.5rem] xl:[&_.site-logo-img]:h-11 xl:[&_.site-logo-img]:max-w-[12rem] 2xl:[&_.site-logo-img]:h-12 2xl:[&_.site-logo-img]:max-w-[14rem]">
            {headerBrand}
          </div>

          {/* ── Center column ──────────────────────────────────────────── */}
          <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-center justify-self-stretch overflow-visible lg:justify-self-center">
            <StorefrontHeaderNav />
          </div>

          {/* ── Right column ───────────────────────────────────────────── */}
          <div className="col-start-3 row-start-1 flex shrink-0 items-center justify-end gap-1 justify-self-end sm:gap-1.5 lg:gap-2">
            {/* Theme toggle or refresh — desktop only */}
            {isAdminRoute ? (
              <button
                type="button"
                onClick={refreshAdminPage}
                disabled={adminRefreshing}
                className={`${iconBtn} hidden lg:grid`}
                aria-label="Refresh page"
              >
                <RefreshIcon
                  className={`h-5 w-5${adminRefreshing ? " animate-spin" : ""}`}
                  aria-hidden
                />
              </button>
            ) : !loggedIn ? (
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={`${iconBtn} hidden lg:grid`}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {themeToggleIcon}
              </button>
            ) : null}

            {/* Search — desktop only (mobile search is on the left) */}
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              className={`${iconBtn} hidden lg:grid`}
              aria-label="Search"
            >
              <SearchIcon />
            </button>

            {/* Cart — hidden on mobile admin; Publish replaces it there */}
            {isAdminRoute ? (
              <span className="lg:hidden">
                <AdminPublishControl variant="compact" className={iconBtn} />
              </span>
            ) : (
              <Link href="/cart" className={`${iconBtn} relative`} aria-label="Cart">
                <CartIcon />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </Link>
            )}

            {/* Mobile profile avatar — shown right of cart on mobile */}
            {loggedIn ? (
              <div ref={userMobileRef} className="relative shrink-0 lg:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setUserOpen((o) => !o);
                  }}
                  className="overflow-visible rounded-full border border-transparent p-0 transition hover:border-border hover:bg-muted/60"
                  aria-label="My account"
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                >
                  <AvatarInner />
                </button>

                {userOpen ? (
                  <SiteUserMenu
                    className="absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-1.5rem))]"
                    displayName={displayName}
                    isAdmin={canAccessAdminPanel}
                    accountMeta={roleLabel ?? undefined}
                    unread={unread}
                    onClose={() => setUserOpen(false)}
                    onLogout={() => void logout()}
                  />
                ) : null}
              </div>
            ) : null}

            {/* Desktop profile button — md+ screens */}
            {loggedIn ? (
              <div ref={userDesktopRef} className="relative hidden shrink-0 lg:block">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setUserOpen((o) => !o);
                  }}
                  className="flex items-center gap-2 overflow-visible rounded-xl border border-transparent py-1 pl-1 pr-2 transition hover:border-border hover:bg-muted/60"
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                >
                  <AvatarInner />
                  <span className="hidden max-w-[7.5rem] truncate text-sm font-semibold text-foreground xl:inline">
                    {displayName}
                  </span>
                  <ChevronIcon
                    className={`h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-200 ${
                      userOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {userOpen ? (
                  <SiteUserMenu
                    className="absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-1.5rem))]"
                    displayName={displayName}
                    isAdmin={canAccessAdminPanel}
                    accountMeta={roleLabel ?? undefined}
                    unread={unread}
                    onClose={() => setUserOpen(false)}
                    onLogout={() => void logout()}
                  />
                ) : null}
              </div>
            ) : (
              <Link
                href="/login"
                className={`${iconBtn} shrink-0`}
                aria-label="Log in"
              >
                <UserCircleIcon />
              </Link>
            )}
          </div>
        </div>

        {/* Search bar — storefront only (admin mobile has no search in header) */}
        {searchOpen && !isAdminRoute && (
          <form
            onSubmit={onSearch}
            className={`relative border-t border-border py-3 ${HOME_CONTAINER_CLS}`}
            role="search"
          >
            <label htmlFor="header-search" className="sr-only">
              Search products
            </label>
            <ProductSearchAutocomplete
              value={term}
              onChange={setTerm}
              inputId="header-search"
              placeholder="Search products…"
              autoFocus
              minChars={1}
              limit={6}
              onProductSelect={() => {
                setMenuOpen(false);
                setSearchOpen(false);
              }}
            />
          </form>
        )}
      </header>

      {/* Mobile nav drawer — only shown when no external sidebar handler */}
      {menuOpen && !onOpenMobileMenu && (
        <div
          className="pointer-events-auto fixed inset-x-0 bottom-0 top-14 z-[990] sm:top-16 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="admin-panel admin-sidebar site-mobile-menu absolute bottom-0 left-0 top-0 flex w-[min(20rem,85vw)] flex-col shadow-2xl">
            <div className="admin-sidebar-nav min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4 pt-3">
              <div className="admin-menu-panel">
                <ul className="flex flex-col gap-2.5">
                  <Suspense
                    fallback={
                      <MobileNavItemsFallback
                        navItems={navItems}
                        headerOthers={headerOthers}
                        onClose={() => setMenuOpen(false)}
                      />
                    }
                  >
                    <MobileNavItems
                      navItems={navItems}
                      headerOthers={headerOthers}
                      pathname={pathname ?? ""}
                      onClose={() => setMenuOpen(false)}
                    />
                  </Suspense>
                  <MobileNavOthers
                    items={headerOthers}
                    pathname={pathname ?? ""}
                    typeParam={null}
                    onClose={() => setMenuOpen(false)}
                  />
                </ul>
              </div>
            </div>

          </nav>
        </div>
      )}
    </>
  );

  if (headerPortaled && !shellEmbedded && typeof document !== "undefined") {
    return createPortal(headerChrome, document.body);
  }

  return headerChrome;
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
      />
    </svg>
  );
}

function UserCircleIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeWidth={1.5}
        d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
