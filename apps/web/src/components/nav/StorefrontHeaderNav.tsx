"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronIcon } from "@/components/admin/icons";
import { useSiteMenus } from "@/components/SiteMenusProvider";
import {
  isHeaderOthersMenuActive,
  isSiteMenuLinkActive,
  splitStorefrontHeaderNav,
  type SiteMenuLink,
} from "@/lib/site-menus";
import { hardNavigateFromMediaCatalog } from "@/lib/storefront-nav";

function NavOthersDropdown({
  items,
  pathname,
  typeParam,
}: {
  items: SiteMenuLink[];
  pathname: string;
  typeParam: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = isHeaderOthersMenuActive(items, pathname, typeParam);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    const id = window.setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", handleClick);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="site-nav-dropdown">
      <button
        type="button"
        className={`site-nav-link site-nav-dropdown__trigger${active ? " site-nav-link--active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Others</span>
        <ChevronIcon
          className={`site-nav-dropdown__chevron${open ? " site-nav-dropdown__chevron--open" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="site-nav-dropdown__menu z-[70]" role="menu">
          {items.map((item) => {
            const itemActive = isSiteMenuLinkActive(item.href, pathname, typeParam);
            return (
              <Link
                key={item.href}
                href={item.href as "/"}
                role="menuitem"
                className={`site-nav-dropdown__item${itemActive ? " site-nav-dropdown__item--active" : ""}`}
                onClick={(event) => {
                  setOpen(false);
                  hardNavigateFromMediaCatalog(pathname, item.href, router, event);
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function NavLinks({
  navItems,
  headerOthers,
  pathname,
}: {
  navItems: SiteMenuLink[];
  headerOthers: SiteMenuLink[];
  pathname: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const { primary } = splitStorefrontHeaderNav(navItems, headerOthers);
  return (
    <>
      {primary.map((item) => {
        const active = isSiteMenuLinkActive(item.href, pathname, typeParam);
        return (
          <Link
            key={item.href}
            href={item.href as "/"}
            className={active ? "site-nav-link site-nav-link--active" : "site-nav-link"}
            onClick={(event) => {
              hardNavigateFromMediaCatalog(pathname, item.href, router, event);
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function NavLinksFallback({
  navItems,
  headerOthers,
}: {
  navItems: SiteMenuLink[];
  headerOthers: SiteMenuLink[];
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { primary } = splitStorefrontHeaderNav(navItems, headerOthers);
  return (
    <>
      {primary.map((item) => (
        <Link
          key={item.href}
          href={item.href as "/"}
          className="site-nav-link"
          onClick={(event) => {
            hardNavigateFromMediaCatalog(pathname, item.href, router, event);
          }}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

/** Homepage-style primary nav + Others dropdown (desktop lg+). */
export function StorefrontHeaderNav({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const siteMenus = useSiteMenus();
  const navClassName = [
    "site-header-nav scrollbar-none hidden min-w-0 max-w-full flex-nowrap items-center justify-center overflow-visible text-sm font-bold lg:flex",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={navClassName} aria-label="Main">
      <Suspense
        fallback={
          <NavLinksFallback
            navItems={siteMenus.header}
            headerOthers={siteMenus.headerOthers}
          />
        }
      >
        <NavLinks
          navItems={siteMenus.header}
          headerOthers={siteMenus.headerOthers}
          pathname={pathname}
        />
      </Suspense>
      <NavOthersDropdown
        items={siteMenus.headerOthers}
        pathname={pathname}
        typeParam={null}
      />
    </nav>
  );
}
