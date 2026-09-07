import type { ComponentType, SVGProps } from "react";
import {
  BellIcon,
  BoxIcon,
  CartIcon,
  ChartIcon,
  ChatIcon,
  DollarIcon,
  GridIcon,
  ImageAttachIcon,
  KeyIcon,
  LayersIcon,
  LinkIcon,
  MailIcon,
  SearchIcon,
  PulseIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldIcon,
  StoreIcon,
  SunIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from "@/components/admin/icons";

export type AdminIcon = ComponentType<SVGProps<SVGSVGElement>>;

import type { PermissionKey } from "@/lib/role-permissions";

export type NavChild = {
  href: string;
  label: string;
  icon: AdminIcon;
  keywords?: string[];
  adminOnly?: boolean;
  requiredPermission?: PermissionKey;
};

export type NavAccent =
  | "brand"
  | "brand-deep"
  | "warning"
  | "accent"
  | "success"
  | "accent-hover"
  | "danger"
  | "violet"
  | "fuchsia";

export type NavItem = {
  href: string;
  label: string;
  icon: AdminIcon;
  badge?: string;
  accent?: NavAccent;
  keywords?: string[];
  adminOnly?: boolean;
  requiredPermission?: PermissionKey;
  children?: NavChild[];
};

export function getNavItemAccentClass(item: Pick<NavItem, "accent">): string {
  return item.accent ? `admin-nav-accent--${item.accent}` : "";
}

export type NavSection = {
  id: string;
  title: string;
  icon?: AdminIcon;
  items: NavItem[];
};

export const ADMIN_NAV: NavSection[] = [
  {
    id: "overview",
    title: "Administration Menu",
    icon: GridIcon,
    items: [
      { href: "/admin", label: "Dashboard", icon: GridIcon, accent: "brand" },
    ],
  },
  {
    id: "catalog",
    title: "Catalog",
    items: [
      {
        href: "/admin/products",
        label: "Products",
        icon: BoxIcon,
        accent: "accent-hover",
        children: [
          { href: "/admin/products", label: "All Products", icon: BoxIcon },
          { href: "/admin/products/new", label: "Add product", icon: TagIcon },
          {
            href: "/admin/products/categories",
            label: "Categories",
            icon: LayersIcon,
          },
          { href: "/admin/products/brands", label: "Brands", icon: TagIcon },
          {
            href: "/admin/products/stock",
            label: "Stock management",
            icon: KeyIcon,
          },
          {
            href: "/admin/products/reviews",
            label: "Customer reviews",
            icon: ChatIcon,
          },
        ],
      },
    ],
  },
  {
    id: "commerce",
    title: "Commerce",
    items: [
      {
        href: "/admin/sales",
        label: "Sales",
        icon: CartIcon,
        accent: "warning",
        children: [
          { href: "/admin/sales/orders", label: "Orders", icon: CartIcon },
          {
            href: "/admin/sales/analytics",
            label: "Sales Analytics",
            icon: ChartIcon,
            keywords: ["analytics", "reports", "revenue", "products", "top sellers"],
          },
          { href: "/admin/sales/payments", label: "Payments", icon: DollarIcon },
          {
            href: "/admin/sales/sms-logs",
            label: "SMS logs",
            icon: ChatIcon,
            keywords: ["bkash", "nagad", "mfs"],
          },
          {
            href: "/admin/sales/email-logs",
            label: "Email logs",
            icon: MailIcon,
            keywords: ["smtp", "mail", "notification", "delivery"],
          },
          { href: "/admin/sales/refunds", label: "Refunds", icon: ReceiptIcon },
          { href: "/admin/sales/coupons", label: "Coupons", icon: TagIcon },
          { href: "/admin/sales/vouchers", label: "Vouchers", icon: ReceiptIcon },
        ],
      },
    ],
  },
  {
    id: "content",
    title: "Content",
    items: [
      {
        href: "/admin/blogs/overview",
        label: "Blog",
        icon: LinkIcon,
        accent: "accent",
        requiredPermission: "view_blog_overview",
        keywords: ["blog", "article", "post", "cms", "content", "news", "overview", "dashboard"],
        children: [
          {
            href: "/admin/blogs/overview",
            label: "Overview",
            icon: GridIcon,
            requiredPermission: "view_blog_overview",
          },
          {
            href: "/admin/blogs",
            label: "All Posts",
            icon: LinkIcon,
            requiredPermission: "view_blog_posts",
          },
          {
            href: "/admin/blogs/create",
            label: "Create Post",
            icon: TagIcon,
            requiredPermission: "create_edit_blog_posts",
          },
          {
            href: "/admin/blogs/categories",
            label: "Categories",
            icon: LayersIcon,
            requiredPermission: "manage_blog_categories",
          },
          {
            href: "/admin/blogs/settings",
            label: "Settings",
            icon: SettingsIcon,
            requiredPermission: "view_blog_overview",
            keywords: ["likes", "reviews", "views", "profile", "features"],
          },
        ],
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    items: [
      {
        href: "/admin/chat",
        label: "Support",
        icon: ChatIcon,
        accent: "warning",
        keywords: [
          "chat",
          "guest",
          "images",
          "saved replies",
          "quick replies",
          "tickets",
          "request",
          "product",
          "email",
          "contact",
          "inbox",
        ],
        children: [
          { href: "/admin/chat", label: "Live chat", icon: ChatIcon },
          {
            href: "/admin/chat/settings",
            label: "Chat settings",
            icon: SettingsIcon,
            keywords: ["guest", "images", "quick replies"],
          },
          {
            href: "/admin/chat/status",
            label: "System status",
            icon: PulseIcon,
            keywords: ["rooms", "messages", "transport", "overview"],
          },
          {
            href: "/admin/saved-replies",
            label: "Saved replies",
            icon: MailIcon,
            adminOnly: true,
          },
          { href: "/admin/tickets", label: "Tickets", icon: ReceiptIcon },
          {
            href: "/admin/product-requests",
            label: "Product requests",
            icon: BoxIcon,
            keywords: ["request", "product", "wishlist", "suggestion"],
          },
          {
            href: "/admin/contact-inbox",
            label: "Email inbox",
            icon: MailIcon,
            keywords: ["email", "contact", "inbox", "reply", "message"],
          },
        ],
      },
    ],
  },
  {
    id: "system",
    title: "System",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        icon: SettingsIcon,
        accent: "accent-hover",
        children: [
          {
            href: "/admin/settings/license",
            label: "License key",
            icon: KeyIcon,
            keywords: ["amarpin", "license", "activation", "feature"],
          },
          { href: "/admin/settings", label: "General", icon: SettingsIcon },
          {
            href: "/admin/settings/suppliers",
            label: "Suppliers",
            icon: TruckIcon,
          },
          {
            href: "/admin/settings/delivery",
            label: "Manual Delivery",
            icon: PulseIcon,
          },
          {
            href: "/admin/settings/payments",
            label: "Payment gateways",
            icon: DollarIcon,
            keywords: ["checkout", "guest", "wallet", "mfs", "bkash", "nagad", "trx"],
          },
          {
            href: "/admin/settings/security",
            label: "Security",
            icon: ShieldIcon,
          },
          {
            href: "/admin/settings/roles",
            label: "Roles & permissions",
            icon: KeyIcon,
          },
          {
            href: "/admin/settings/notifications",
            label: "Notifications",
            icon: BellIcon,
          },
          {
            href: "/admin/settings/email",
            label: "Email / SMTP",
            icon: MailIcon,
            keywords: ["smtp", "mail", "email", "sender", "template"],
          },
          {
            href: "/admin/settings/seo",
            label: "SEO Management",
            icon: SearchIcon,
            keywords: [
              "seo",
              "meta",
              "sitemap",
              "robots",
              "schema",
              "analytics",
              "open graph",
            ],
          },
          {
            href: "/admin/settings/customer-panel",
            label: "Customer panel",
            icon: UsersIcon,
            keywords: ["guest checkout", "checkout", "storefront"],
          },
          {
            href: "/admin/settings/menus",
            label: "Header & footer menus",
            icon: LinkIcon,
            keywords: ["navigation", "header", "footer", "menu", "links"],
          },
          {
            href: "/admin/settings/homepage",
            label: "Homepage slider",
            icon: ImageAttachIcon,
            keywords: ["banner", "hero", "carousel", "slider", "homepage"],
          },
          {
            href: "/admin/settings/website",
            label: "Website pricing",
            icon: GridIcon,
            keywords: ["website", "pricing", "packages", "plans", "laravel"],
          },
        ],
      },
      {
        href: "/admin/customers",
        label: "Customers",
        icon: UsersIcon,
        accent: "warning",
        children: [
          { href: "/admin/customers", label: "All Customers", icon: UsersIcon },
          {
            href: "/admin/customers/resellers",
            label: "Resellers",
            icon: StoreIcon,
          },
          {
            href: "/admin/customers/affiliates",
            label: "Affiliates",
            icon: LinkIcon,
          },
          {
            href: "/admin/customers/kyc",
            label: "KYC requests",
            icon: ShieldIcon,
          },
        ],
      },
      {
        href: "/admin/settings/appearance",
        label: "Appearance & theme",
        icon: SunIcon,
        accent: "danger",
        keywords: ["logo", "theme", "colors", "brand"],
        children: [
          {
            href: "/admin/settings/appearance/logos",
            label: "Logos",
            icon: StoreIcon,
            keywords: ["site logo", "footer", "admin header"],
          },
          {
            href: "/admin/settings/appearance/theme",
            label: "Theme & colors",
            icon: SunIcon,
            keywords: ["accent", "palette", "dark", "light"],
          },
        ],
      },
    ],
  },
];

export type FlatNavLink = {
  href: string;
  label: string;
  section: string;
  parent?: string;
  parentHref?: string;
};

export function flattenNav(sections = ADMIN_NAV): FlatNavLink[] {
  const links: FlatNavLink[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.children?.length) {
        for (const child of item.children) {
          links.push({
            href: child.href,
            label: child.label,
            section: section.title,
            parent: item.label,
            parentHref: item.href,
          });
        }
      } else {
        links.push({
          href: item.href,
          label: item.label,
          section: section.title,
        });
      }
    }
  }
  return links;
}

export function getAdminPageMeta(pathname: string | null): {
  section: string;
  title: string;
  icon: AdminIcon;
} {
  if (!pathname || pathname === "/admin") {
    return { section: "Administration", title: "Admin panel", icon: GridIcon };
  }

  const crumbs = getBreadcrumbs(pathname);
  const crumb = crumbs[0];
  if (!crumb) {
    return { section: "Administration", title: "Admin", icon: GridIcon };
  }

  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      if (item.children?.length) {
        for (const child of item.children) {
          if (
            pathname === child.href ||
            pathname.startsWith(`${child.href}/`)
          ) {
            return {
              section: section.title,
              title: child.label,
              icon: child.icon,
            };
          }
        }
      }
      if (
        pathname === item.href ||
        (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
      ) {
        return {
          section: section.title,
          title: item.label,
          icon: item.icon,
        };
      }
    }
  }

  return { section: crumb.section, title: crumb.label, icon: GridIcon };
}

export function getBreadcrumbs(pathname: string | null): FlatNavLink[] {
  if (!pathname) return [];
  const crumbs: FlatNavLink[] = [];
  const all = flattenNav();

  const exact = all.find((l) => l.href === pathname);
  if (exact) {
    crumbs.push(exact);
    return crumbs;
  }

  const sorted = [...all].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find(
    (l) => l.href !== "/admin" && pathname.startsWith(`${l.href}/`),
  );
  if (match) crumbs.push(match);
  return crumbs;
}

function getExpandableNavHrefs(): string[] {
  return ADMIN_NAV.flatMap((section) =>
    section.items
      .filter((item) => item.children?.length)
      .map((item) => item.href),
  );
}

/** When two flat nav links share a prefix (e.g. /admin/chat vs /admin/chat/settings). */
function hasMoreSpecificNavMatch(pathname: string, href: string): boolean {
  for (const link of flattenNav()) {
    const otherHref = link.href;
    if (otherHref === href || !otherHref.startsWith(`${href}/`)) continue;
    if (pathname === otherHref || pathname.startsWith(`${otherHref}/`)) {
      return true;
    }
  }
  return false;
}

export function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;

  if (hasMoreSpecificNavMatch(pathname, href)) return false;

  const ownedByMoreSpecificGroup = getExpandableNavHrefs().some(
    (otherHref) =>
      otherHref !== href &&
      otherHref.startsWith(`${href}/`) &&
      (pathname === otherHref || pathname.startsWith(`${otherHref}/`)),
  );

  return !ownedByMoreSpecificGroup;
}

export function isChildActive(
  pathname: string | null,
  childHref: string,
  parentHref: string,
): boolean {
  if (!pathname) return false;
  if (pathname === childHref) return true;
  if (childHref === parentHref) return false;
  if (!pathname.startsWith(`${childHref}/`)) return false;
  return !hasMoreSpecificNavMatch(pathname, childHref);
}

export function hasActiveNavChild(
  pathname: string | null,
  item: NavItem,
): boolean {
  if (!pathname || !item.children?.length) return false;
  return item.children.some((child) =>
    isChildActive(pathname, child.href, item.href),
  );
}

export function isNavParentLinkActive(
  pathname: string | null,
  item: NavItem,
): boolean {
  return isNavItemActive(pathname, item.href) && !hasActiveNavChild(pathname, item);
}

export function isNavGroupRouteOpen(
  pathname: string | null,
  item: NavItem,
): boolean {
  return isNavItemActive(pathname, item.href) || hasActiveNavChild(pathname, item);
}

export function findActiveGroup(pathname: string | null): string | null {
  if (!pathname) return null;
  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      if (item.children && isNavItemActive(pathname, item.href)) {
        return item.href;
      }
    }
  }
  return null;
}

export function filterNavSections(
  sections: NavSection[],
  query: string,
): NavSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;

  return sections
    .map((section) => {
      const items = section.items
        .map((item) => {
          const itemMatch =
            item.label.toLowerCase().includes(q) ||
            item.keywords?.some((k) => k.includes(q));
          if (!item.children) {
            return itemMatch ? item : null;
          }
          const children = item.children.filter(
            (c) =>
              c.label.toLowerCase().includes(q) ||
              c.keywords?.some((k) => k.includes(q)) ||
              item.label.toLowerCase().includes(q),
          );
          if (itemMatch || children.length) {
            return { ...item, children: itemMatch ? item.children : children };
          }
          return null;
        })
        .filter((i): i is NavItem => i !== null);
      return items.length ? { ...section, items } : null;
    })
    .filter((s): s is NavSection => s !== null);
}

export type AdminNavFilterOptions = {
  isStrictAdmin: boolean;
  permissions?: Record<string, boolean>;
};

function navItemAllowed(
  item: { adminOnly?: boolean; requiredPermission?: PermissionKey },
  options: AdminNavFilterOptions,
): boolean {
  if (item.adminOnly && !options.isStrictAdmin) return false;
  if (!item.requiredPermission) {
    // Blog-only staff (e.g. blogger) lack admin_panel_access — hide unrestricted items.
    if (options.permissions && !options.permissions.admin_panel_access) {
      return false;
    }
    return true;
  }
  if (options.permissions) {
    return Boolean(options.permissions[item.requiredPermission]);
  }
  return options.isStrictAdmin;
}

export function filterAdminNav(
  sections: NavSection[],
  options: AdminNavFilterOptions | boolean,
): NavSection[] {
  const opts: AdminNavFilterOptions =
    typeof options === "boolean" ? { isStrictAdmin: options } : options;

  if (opts.isStrictAdmin && !opts.permissions) return sections;

  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (item.children?.length) {
            const children = item.children.filter((child) =>
              navItemAllowed(child, opts),
            );
            if (!children.length) return null;
            if (!navItemAllowed(item, opts) && !children.length) return null;
            return { ...item, children };
          }
          if (!navItemAllowed(item, opts)) return null;
          return item;
        })
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((section) => section.items.length > 0);
}

export function searchNavLinks(query: string, limit = 8): FlatNavLink[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return flattenNav()
    .filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.parent?.toLowerCase().includes(q) ||
        l.section.toLowerCase().includes(q) ||
        l.href.toLowerCase().includes(q),
    )
    .slice(0, limit);
}
