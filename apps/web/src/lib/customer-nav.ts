import type { ComponentType, SVGProps } from "react";
import {
  BellIcon,
  BoxIcon,
  CartIcon,
  ChartIcon,
  ChatIcon,
  DollarIcon,
  GridIcon,
  LayersIcon,
  LinkIcon,
  MailIcon,
  ReceiptIcon,
  SettingsIcon,
  StoreIcon,
  TagIcon,
  UsersIcon,
} from "@/components/admin/icons";
import { PANEL_NAV, type PanelNavItem } from "@/lib/customer-panel";

type IconProps = SVGProps<SVGSVGElement>;

const NAV_ICONS: Record<string, ComponentType<IconProps>> = {
  home: GridIcon,
  categories: LayersIcon,
  products: BoxIcon,
  blog: LinkIcon,
  blog_overview: GridIcon,
  blog_create: TagIcon,
  blog_categories: LayersIcon,
  blog_settings: SettingsIcon,
  cart: CartIcon,
  checkout: DollarIcon,
  wallet: DollarIcon,
  orders: ReceiptIcon,
  downloads: BoxIcon,
  wishlist: TagIcon,
  referral: LinkIcon,
  affiliate: ChartIcon,
  rewards: TagIcon,
  support: ChatIcon,
  chat: ChatIcon,
  email_support: MailIcon,
  tickets: ReceiptIcon,
  notifications: BellIcon,
  settings: SettingsIcon,
  profile: UsersIcon,
  reseller: StoreIcon,
};

export function getCustomerNavAccentClass(
  item: Pick<PanelNavItem, "accent">,
): string {
  return item.accent ? `admin-nav-accent--${item.accent}` : "";
}

export function getCustomerNavIcon(key: string): ComponentType<IconProps> {
  return NAV_ICONS[key] ?? BoxIcon;
}

/** Routes that use CustomerPanelShell — excludes storefront pages like `/` and `/products`. */
export const CUSTOMER_PANEL_ROUTE_PREFIXES = [
  "/dashboard",
  "/wallet",
  "/orders",
  "/downloads",
  "/wishlist",
  "/referral",
  "/affiliate",
  "/rewards",
  "/support",
  "/email-support",
  "/chat",
  "/notifications",
  "/settings",
  "/profile",
  "/reseller",
  "/tickets",
  "/cart",
  "/checkout",
  "/categories",
];

export function isCustomerPanelRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  // Cart & checkout use storefront header/footer; layout stays in CustomerPanelShell.
  if (
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname === "/checkout/pay" ||
    pathname.startsWith("/checkout/pay/")
  ) {
    return false;
  }
  return CUSTOMER_PANEL_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Checkout uses a focused layout without customer dashboard chrome. */
export function isCustomerCheckoutRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/checkout";
}

/** Cart hides dashboard chrome only — keeps the default cart page layout. */
export function isCustomerCartRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/cart";
}

export function getCustomerBreadcrumb(pathname: string | null): string {
  if (!pathname || pathname === "/dashboard") return "Dashboard";
  const item = PANEL_NAV.find(
    (nav) =>
      pathname === nav.href || pathname.startsWith(`${nav.href}/`),
  );
  if (item) return item.label;
  if (pathname.startsWith("/tickets")) return "Support tickets";
  return "Account";
}

export function isCustomerNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;

  for (const item of PANEL_NAV) {
    const otherHref = item.href;
    if (otherHref === href || !otherHref.startsWith(`${href}/`)) continue;
    if (pathname === otherHref || pathname.startsWith(`${otherHref}/`)) {
      return false;
    }
  }

  return true;
}

export type { PanelNavItem };
