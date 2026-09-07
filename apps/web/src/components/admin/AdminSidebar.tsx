"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronIcon } from "@/components/admin/icons";
import {
  ADMIN_NAV,
  filterAdminNav,
  getNavItemAccentClass,
  isChildActive,
  isNavGroupRouteOpen,
  isNavItemActive,
  isNavParentLinkActive,
  type NavItem,
} from "@/lib/admin-nav";
import { hasStrictAdminRole } from "@/lib/auth-roles";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

type Props = {
  open: boolean;
  onClose: () => void;
};

const EXPANDED_STORAGE_KEY = "admin-nav-expanded";

function isAdminRoute(href: string): href is Route {
  return href === "/admin" || href.startsWith("/admin/");
}

function readExpandedGroup(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as string | string[] | null;
    if (typeof parsed === "string" && parsed) return parsed;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0] ?? null;
    return null;
  } catch {
    return null;
  }
}

function writeExpandedGroup(href: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (href) {
      sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(href));
    } else {
      sessionStorage.removeItem(EXPANDED_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function useGroupOpenState(pathname: string | null) {
  const [manualExpanded, setManualExpanded] = useState<string | null>(
    readExpandedGroup,
  );
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setManualCollapsed(new Set());
    setManualExpanded(null);
  }, [pathname]);

  useEffect(() => {
    writeExpandedGroup(manualExpanded);
  }, [manualExpanded]);

  const isGroupOpen = useCallback(
    (item: NavItem) => {
      if (manualCollapsed.has(item.href)) return false;
      if (manualExpanded) return manualExpanded === item.href;
      return isNavGroupRouteOpen(pathname, item);
    },
    [manualCollapsed, manualExpanded, pathname],
  );

  const expandGroup = useCallback((item: NavItem) => {
    setManualCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(item.href);
      return next;
    });
    setManualExpanded(item.href);
  }, []);

  const toggleGroup = useCallback(
    (item: NavItem) => {
      const routeOpen = isNavGroupRouteOpen(pathname, item);
      const open =
        !manualCollapsed.has(item.href) &&
        (manualExpanded === item.href ||
          (!manualExpanded && routeOpen));

      if (open) {
        if (routeOpen && !manualExpanded) {
          setManualCollapsed((prev) => {
            const next = new Set(prev);
            next.add(item.href);
            return next;
          });
          return;
        }
        setManualExpanded(null);
        return;
      }

      setManualCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(item.href);
        return next;
      });
      setManualExpanded(item.href);
    },
    [manualCollapsed, manualExpanded, pathname],
  );

  return { isGroupOpen, toggleGroup, expandGroup };
}

function AdminNavItems({
  pathname,
  onClose,
  isGroupOpen,
  toggleGroup,
  expandGroup,
  navigateTo,
  navSections,
}: {
  pathname: string | null;
  onClose: () => void;
  isGroupOpen: (item: NavItem) => boolean;
  toggleGroup: (item: NavItem) => void;
  expandGroup: (item: NavItem) => void;
  navigateTo: (href: string) => void;
  navSections: typeof ADMIN_NAV;
}) {
  return (
    <>
      {navSections.map((section) => {
        const SectionIcon = section.icon;

        return (
        <div
          key={section.id}
          className={`admin-menu-section admin-menu-section--${section.id}`}
        >
          <div className="admin-menu-section-head">
            {SectionIcon ? (
              <span className="admin-menu-section-icon" aria-hidden>
                <SectionIcon className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <p className="admin-menu-section-label">{section.title}</p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const accentClass = getNavItemAccentClass(item);

              if (!item.children?.length) {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : isNavItemActive(pathname, item.href);

                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={{ pathname: item.href }}
                      prefetch={false}
                      onClick={() => onClose()}
                      className={`admin-nav-link admin-nav-item ${accentClass} ${active ? "admin-nav-link-active" : ""}`}
                    >
                      {active ? (
                        <span className="admin-nav-indicator" aria-hidden />
                      ) : null}
                      <span
                        className={`admin-nav-icon-box ${active ? "admin-nav-icon-box-active" : ""}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="admin-nav-badge">{item.badge}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              }

              const parentLinkActive = isNavParentLinkActive(pathname, item);
              const openGroup = isGroupOpen(item);

              return (
                <li
                  key={item.href}
                  className={`admin-nav-group admin-nav-item ${accentClass} admin-nav-group--${section.id}${openGroup ? " admin-nav-group--open" : ""}`}
                >
                  <div
                    className={`admin-nav-link admin-nav-link-group ${parentLinkActive ? "admin-nav-link-active" : ""}`}
                  >
                    {parentLinkActive ? (
                      <span className="admin-nav-indicator" aria-hidden />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (!openGroup) {
                          expandGroup(item);
                          return;
                        }
                        navigateTo(item.href);
                      }}
                      className="admin-nav-link-main"
                    >
                      <span
                        className={`admin-nav-icon-box ${parentLinkActive ? "admin-nav-icon-box-active" : ""}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {item.label}
                      </span>
                      {item.badge ? (
                        <span className="admin-nav-badge">{item.badge}</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(item);
                      }}
                      className="admin-nav-chevron"
                      aria-expanded={openGroup}
                      aria-label={`${openGroup ? "Collapse" : "Expand"} ${item.label}`}
                    >
                      <ChevronIcon
                        className={`admin-nav-chevron-icon h-4 w-4 shrink-0 ${openGroup ? "admin-nav-chevron-icon--open" : ""}`}
                      />
                    </button>
                  </div>

                  {openGroup ? (
                    <div className="admin-subnav-box">
                      <ul className="admin-subnav-inner space-y-1.5">
                        {item.children.map((child) => {
                          const childActive = isChildActive(
                            pathname,
                            child.href,
                            item.href,
                          );
                          const ChildIcon = child.icon;
                          return (
                            <li key={child.href}>
                              <Link
                                href={{ pathname: child.href }}
                                prefetch={false}
                                onClick={() => onClose()}
                                className={`admin-subnav-link ${childActive ? "admin-subnav-link-active" : ""}`}
                              >
                                {childActive ? (
                                  <span
                                    className="admin-subnav-indicator"
                                    aria-hidden
                                  />
                                ) : null}
                                <span
                                  className={`admin-subnav-icon-box ${childActive ? "admin-subnav-icon-box-active" : ""}`}
                                >
                                  <ChildIcon className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0 flex-1 truncate">
                                  {child.label}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
        );
      })}
    </>
  );
}

export function AdminSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { isGroupOpen, toggleGroup, expandGroup } = useGroupOpenState(pathname);
  const [isStrictAdmin, setIsStrictAdmin] = useState(false);
  const { permissions } = useAdminPermissions();

  useEffect(() => {
    const sync = () => setIsStrictAdmin(hasStrictAdminRole());
    sync();
    window.addEventListener("auth-change", sync);
    return () => window.removeEventListener("auth-change", sync);
  }, []);

  const navSections = filterAdminNav(ADMIN_NAV, {
    isStrictAdmin,
    permissions,
  });

  const navigateTo = useCallback(
    (href: string) => {
      onClose();
      if (pathname === href) return;
      if (isAdminRoute(href)) {
        router.push(href);
      }
    },
    [onClose, pathname, router],
  );

  const navProps = {
    pathname,
    onClose,
    isGroupOpen,
    toggleGroup,
    expandGroup,
    navigateTo,
    navSections,
  };

  return (
    <aside
      className={`admin-sidebar fixed bottom-0 left-0 top-14 z-40 flex h-[calc(100dvh-3.5rem)] w-[min(20rem,85vw)] flex-col overflow-hidden sm:top-16 sm:h-[calc(100dvh-4rem)] lg:w-80 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <nav className="admin-sidebar-nav flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-3 lg:py-4">
        <div className="admin-menu-panel admin-sidebar-menu-panel min-h-0 flex-1 overflow-hidden">
          <div className="admin-sidebar-menu-scroll h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain">
            <div className="admin-sidebar-menu-scroll-inner space-y-4">
              <AdminNavItems {...navProps} />
            </div>
          </div>
        </div>

      </nav>
    </aside>
  );
}
