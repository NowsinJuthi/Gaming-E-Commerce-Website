"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronIcon, GridIcon } from "@/components/admin/icons";
import { CustomerBlogAccessModal } from "@/components/customer/CustomerBlogAccessModal";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { hasAdminRole, hasBlogWorkspaceRole } from "@/lib/auth-roles";
import { canAccessCustomerBlogNav } from "@/lib/customer-blog-nav";
import { hasFullBlogPermissions } from "@/lib/role-permissions";
import {
  type CustomerAccountNavSection,
  type CustomerNavAccent,
  type PanelNavItem,
} from "@/lib/customer-panel";
import {
  getCustomerNavAccentClass,
  getCustomerNavIcon,
  isCustomerNavActive,
} from "@/lib/customer-nav";

type Props = {
  open: boolean;
  onClose: () => void;
  shop: PanelNavItem[];
  blog: PanelNavItem[];
  accountSections: CustomerAccountNavSection[];
  siteName: string;
};

type NavGroupConfig = {
  id: string;
  sectionTitle: string;
  label: string;
  href: string;
  iconKey: string;
  accent?: CustomerNavAccent;
  items: PanelNavItem[];
};

type NavAccessControl = {
  canAccessItem: (item: PanelNavItem) => boolean;
  canAccessParent: () => boolean;
  onAccessDenied: (label: string) => void;
};

function isGroupRouteActive(pathname: string, items: PanelNavItem[], href: string) {
  return (
    isCustomerNavActive(pathname, href) ||
    items.some((item) => isCustomerNavActive(pathname, item.href))
  );
}

function CustomerNavDropdownGroup({
  group,
  pathname,
  onNavigate,
  accessControl,
}: {
  group: NavGroupConfig;
  pathname: string;
  onNavigate: () => void;
  accessControl?: NavAccessControl;
}) {
  const router = useRouter();
  const routeOpen = isGroupRouteActive(pathname, group.items, group.href);
  const [open, setOpen] = useState(routeOpen);
  const ParentIcon = getCustomerNavIcon(group.iconKey);
  const accentClass = getCustomerNavAccentClass({ accent: group.accent });
  const parentActive = routeOpen;

  useEffect(() => {
    if (routeOpen) setOpen(true);
  }, [routeOpen]);

  if (group.items.length === 0) return null;

  return (
    <li
      className={`admin-nav-group admin-nav-item ${accentClass} admin-nav-group--${group.id}${open ? " admin-nav-group--open" : ""}`}
    >
      <div
        className={`admin-nav-link admin-nav-link-group ${parentActive ? "admin-nav-link-active" : ""}`}
      >
        {parentActive ? <span className="admin-nav-indicator" aria-hidden /> : null}
        <button
          type="button"
          onClick={() => {
            if (!open) {
              setOpen(true);
              return;
            }
            if (accessControl && !accessControl.canAccessParent()) {
              accessControl.onAccessDenied(group.label);
              return;
            }
            onNavigate();
            if (pathname !== group.href) {
              router.push(group.href as "/");
            }
          }}
          className="admin-nav-link-main"
        >
          <span
            className={`admin-nav-icon-box ${parentActive ? "admin-nav-icon-box-active" : ""}`}
          >
            <ParentIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="admin-nav-chevron"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${group.label}`}
        >
          <ChevronIcon
            className={`admin-nav-chevron-icon h-4 w-4 shrink-0${open ? " admin-nav-chevron-icon--open" : ""}`}
          />
        </button>
      </div>

      {open ? (
        <div className="admin-subnav-box">
          <ul className="admin-subnav-inner space-y-1.5">
            {group.items.map((item) => {
              const childActive = isCustomerNavActive(pathname, item.href);
              const ChildIcon = getCustomerNavIcon(item.key);
              const allowed = accessControl ? accessControl.canAccessItem(item) : true;
              const sharedClass = `admin-subnav-link ${childActive ? "admin-subnav-link-active" : ""}`;
              const sharedContent = (
                <>
                  {childActive ? (
                    <span className="admin-subnav-indicator" aria-hidden />
                  ) : null}
                  <span
                    className={`admin-subnav-icon-box ${childActive ? "admin-subnav-icon-box-active" : ""}`}
                  >
                    <ChildIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </>
              );

              return (
                <li key={item.key}>
                  {allowed ? (
                    <Link
                      href={item.href as "/"}
                      prefetch={false}
                      onClick={onNavigate}
                      className={sharedClass}
                    >
                      {sharedContent}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => accessControl?.onAccessDenied(item.label)}
                      className={`${sharedClass} w-full text-left`}
                    >
                      {sharedContent}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function NavDropdownSection({
  group,
  pathname,
  onNavigate,
  accessControl,
}: {
  group: NavGroupConfig;
  pathname: string;
  onNavigate: () => void;
  accessControl?: NavAccessControl;
}) {
  if (group.items.length === 0) return null;

  return (
    <div className={`admin-menu-section admin-menu-section--${group.id}`}>
      <div className="admin-menu-section-head">
        <p className="admin-menu-section-label">{group.sectionTitle}</p>
      </div>
      <ul className="flex flex-col gap-2.5">
        <CustomerNavDropdownGroup
          group={group}
          pathname={pathname}
          onNavigate={onNavigate}
          accessControl={accessControl}
        />
      </ul>
    </div>
  );
}

const ACCOUNT_GROUP_META: Record<
  CustomerAccountNavSection["id"],
  { href: string; iconKey: string; accent?: CustomerNavAccent }
> = {
  "wallet-orders": { href: "/orders", iconKey: "orders", accent: "warning" },
  earn: { href: "/referral", iconKey: "referral", accent: "success" },
  help: { href: "/support", iconKey: "support", accent: "success" },
  profile: { href: "/profile", iconKey: "profile", accent: "danger" },
};

export function CustomerSidebar({
  open,
  onClose,
  shop,
  blog,
  accountSections,
  siteName,
}: Props) {
  const pathname = usePathname() ?? "";
  const dashboardActive = pathname === "/dashboard";
  const [blogAccessDeniedOpen, setBlogAccessDeniedOpen] = useState(false);
  const [blogAccessDeniedLabel, setBlogAccessDeniedLabel] = useState("Blog");
  const isStaff = hasAdminRole() || hasBlogWorkspaceRole();
  const { can, isLoading: permsLoading } = useAdminPermissions();

  const blogAccessOptions = { isStaff, isLoading: permsLoading };

  const showBlogAccessDenied = useCallback(
    (label: string) => {
      if (isStaff && permsLoading) return;
      setBlogAccessDeniedLabel(label);
      setBlogAccessDeniedOpen(true);
    },
    [isStaff, permsLoading],
  );

  const blogAccessControl: NavAccessControl = {
    canAccessItem: (item) =>
      canAccessCustomerBlogNav(item.key, can, blogAccessOptions),
    canAccessParent: () =>
      canAccessCustomerBlogNav("blog_overview", can, blogAccessOptions),
    onAccessDenied: showBlogAccessDenied,
  };

  const blogNavItems = useMemo(() => {
    const postsLabel =
      !permsLoading && hasFullBlogPermissions(can) ? "All Posts" : "My Posts";
    return blog.map((item) =>
      item.key === "blog" ? { ...item, label: postsLabel } : item,
    );
  }, [blog, can, permsLoading]);

  const shopGroup: NavGroupConfig = {
    id: "catalog",
    sectionTitle: "Shop",
    label: "Shop",
    href: "/products",
    iconKey: "products",
    accent: "accent-hover",
    items: shop,
  };

  const blogGroup: NavGroupConfig = {
    id: "content",
    sectionTitle: "Content",
    label: "Blog",
    href: "/dashboard/blogs/overview",
    iconKey: "blog",
    accent: "accent",
    items: blogNavItems,
  };

  return (
    <>
      <aside
      className={`admin-sidebar fixed bottom-0 left-0 top-14 z-40 flex h-[calc(100dvh-3.5rem)] w-[min(20rem,85vw)] flex-col overflow-hidden transition-transform duration-300 ease-out sm:top-16 sm:h-[calc(100dvh-4rem)] lg:w-80 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <nav className="admin-sidebar-nav flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-3 lg:py-4">
        <div className="admin-menu-panel admin-sidebar-menu-panel min-h-0 flex-1 overflow-hidden">
          <div className="admin-sidebar-menu-scroll h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain">
            <div className="admin-sidebar-menu-scroll-inner space-y-4">
              <div className="admin-menu-section admin-menu-section--overview">
                <div className="admin-menu-section-head">
                  <span className="admin-menu-section-icon" aria-hidden>
                    <GridIcon className="h-3.5 w-3.5" />
                  </span>
                  <p className="admin-menu-section-label">{siteName}</p>
                </div>
                <ul className="flex flex-col gap-2.5">
                  <li className="shrink-0">
                    <Link
                      href="/dashboard"
                      prefetch={false}
                      onClick={onClose}
                      className={`admin-nav-link admin-nav-item admin-nav-accent--brand ${dashboardActive ? "admin-nav-link-active" : ""}`}
                    >
                      {dashboardActive ? (
                        <span className="admin-nav-indicator" aria-hidden />
                      ) : null}
                      <span
                        className={`admin-nav-icon-box ${dashboardActive ? "admin-nav-icon-box-active" : ""}`}
                      >
                        <GridIcon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">My Dashboard</span>
                    </Link>
                  </li>
                </ul>
              </div>

              <NavDropdownSection
                group={shopGroup}
                pathname={pathname}
                onNavigate={onClose}
              />
              <NavDropdownSection
                group={blogGroup}
                pathname={pathname}
                onNavigate={onClose}
                accessControl={blog.length > 0 ? blogAccessControl : undefined}
              />
              {accountSections.map((section) => {
                const meta = ACCOUNT_GROUP_META[section.id];
                return (
                  <NavDropdownSection
                    key={section.id}
                    group={{
                      id: section.sectionClass,
                      sectionTitle: section.title,
                      label: section.title,
                      href: meta.href,
                      iconKey: meta.iconKey,
                      accent: meta.accent,
                      items: section.items,
                    }}
                    pathname={pathname}
                    onNavigate={onClose}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </aside>
      <CustomerBlogAccessModal
        open={blogAccessDeniedOpen}
        featureLabel={blogAccessDeniedLabel}
        onClose={() => setBlogAccessDeniedOpen(false)}
      />
    </>
  );
}
