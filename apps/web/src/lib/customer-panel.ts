import {
  getCustomerPanelConfig as fetchCustomerPanelConfig,
  type SiteMenusConfig,
} from "./api";

export interface SiteAppearanceConfig {
  defaultTheme: string;
  accent: string;
  brandColor: string;
  dark: { bg: string; elevated: string; muted: string };
  light: { bg: string; elevated: string; muted: string };
}

export interface CustomerPanelConfig {
  storefront: {
    siteName: string;
    defaultCurrency: string;
    maintenanceMode: boolean;
  };
  nav: Record<string, boolean>;
  rewards: {
    enabled: boolean;
    pointsPerCurrency: number;
    redeemThreshold: number;
  };
  checkout: {
    walletEnabled: boolean;
    gatewayEnabled: boolean;
    manualEnabled: boolean;
    gatewayLabel: string;
    gatewaySubtitle: string;
    paymentMethodOrder: Array<"wallet" | "gateway" | "manual">;
  };
  appearance: SiteAppearanceConfig & {
    logoUrlLight?: string;
    logoUrlDark?: string;
    logoUrlAdmin?: string;
    logoUrlFooter?: string;
    logoUrlFooterLight?: string;
    logoUrlFooterDark?: string;
    logoAlt?: string;
    siteName?: string;
    adminFaviconUrl?: string;
  };
  siteMenus?: SiteMenusConfig;
}

export type CustomerNavAccent =
  | "brand"
  | "brand-deep"
  | "warning"
  | "accent"
  | "success"
  | "accent-hover"
  | "danger"
  | "violet"
  | "fuchsia"
  | "muted";

export type CustomerAccountCategoryId =
  | "wallet-orders"
  | "earn"
  | "help"
  | "profile";

export type PanelNavItem = {
  key: string;
  label: string;
  href: string;
  section: "shop" | "blog" | "account";
  accountCategory?: CustomerAccountCategoryId;
  accent?: CustomerNavAccent;
  auth?: boolean;
};

export type CustomerAccountNavSection = {
  id: CustomerAccountCategoryId;
  title: string;
  sectionClass: string;
  items: PanelNavItem[];
};

export const CUSTOMER_ACCOUNT_CATEGORIES: Array<{
  id: CustomerAccountCategoryId;
  title: string;
  sectionClass: string;
}> = [
  { id: "wallet-orders", title: "Orders", sectionClass: "commerce" },
  { id: "earn", title: "Earn & grow", sectionClass: "content" },
  { id: "help", title: "Help & Chat", sectionClass: "support" },
  { id: "profile", title: "Profile & Settings", sectionClass: "system" },
];

export const PANEL_NAV: PanelNavItem[] = [
  { key: "home", label: "Home", href: "/", section: "shop", accent: "brand" },
  {
    key: "categories",
    label: "Categories",
    href: "/categories",
    section: "shop",
    accent: "violet",
  },
  {
    key: "products",
    label: "Products",
    href: "/products",
    section: "shop",
    accent: "accent-hover",
  },
  { key: "cart", label: "Cart", href: "/cart", section: "shop", accent: "warning", auth: true },
  {
    key: "checkout",
    label: "Checkout",
    href: "/checkout",
    section: "shop",
    accent: "accent-hover",
    auth: true,
  },
  {
    key: "blog_overview",
    label: "Overview",
    href: "/dashboard/blogs/overview",
    section: "blog",
    accent: "brand",
    auth: true,
  },
  {
    key: "blog",
    label: "My Posts",
    href: "/dashboard/blogs",
    section: "blog",
    accent: "accent",
    auth: true,
  },
  {
    key: "blog_create",
    label: "Create Post",
    href: "/dashboard/blogs/create",
    section: "blog",
    accent: "success",
    auth: true,
  },
  {
    key: "blog_categories",
    label: "Categories",
    href: "/dashboard/blogs/categories",
    section: "blog",
    accent: "violet",
    auth: true,
  },
  {
    key: "blog_settings",
    label: "Settings",
    href: "/dashboard/blogs/settings",
    section: "blog",
    accent: "muted",
    auth: true,
  },
  {
    key: "wallet",
    label: "Wallet",
    href: "/wallet",
    section: "account",
    accountCategory: "profile",
    accent: "brand-deep",
    auth: true,
  },
  {
    key: "movie_subscription",
    label: "Movie subscription",
    href: "/dashboard/subscription",
    section: "account",
    accountCategory: "wallet-orders",
    accent: "violet",
    auth: true,
  },
  {
    key: "orders",
    label: "Orders",
    href: "/orders",
    section: "account",
    accountCategory: "wallet-orders",
    accent: "warning",
    auth: true,
  },
  {
    key: "downloads",
    label: "Downloads",
    href: "/downloads",
    section: "account",
    accountCategory: "wallet-orders",
    accent: "violet",
    auth: true,
  },
  {
    key: "referral",
    label: "Referral",
    href: "/referral",
    section: "account",
    accountCategory: "earn",
    accent: "success",
    auth: true,
  },
  {
    key: "affiliate",
    label: "Affiliate",
    href: "/affiliate",
    section: "account",
    accountCategory: "earn",
    accent: "warning",
    auth: true,
  },
  {
    key: "rewards",
    label: "Rewards",
    href: "/rewards",
    section: "account",
    accountCategory: "earn",
    accent: "accent-hover",
    auth: true,
  },
  {
    key: "support",
    label: "Support",
    href: "/support",
    section: "account",
    accountCategory: "help",
    accent: "success",
    auth: true,
  },
  {
    key: "chat",
    label: "Live Chat",
    href: "/chat",
    section: "account",
    accountCategory: "help",
    accent: "warning",
    auth: true,
  },
  {
    key: "email_support",
    label: "Email Support",
    href: "/email-support",
    section: "account",
    accountCategory: "help",
    accent: "brand",
    auth: true,
  },
  {
    key: "tickets",
    label: "Support Tickets",
    href: "/tickets",
    section: "account",
    accountCategory: "help",
    accent: "violet",
    auth: true,
  },
  {
    key: "notifications",
    label: "Notifications",
    href: "/notifications",
    section: "account",
    accountCategory: "profile",
    accent: "brand",
    auth: true,
  },
  {
    key: "wishlist",
    label: "Wishlist",
    href: "/wishlist",
    section: "account",
    accountCategory: "profile",
    accent: "brand",
    auth: true,
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    section: "account",
    accountCategory: "profile",
    accent: "brand-deep",
    auth: true,
  },
  {
    key: "profile",
    label: "Profile Settings",
    href: "/profile",
    section: "account",
    accountCategory: "profile",
    accent: "danger",
    auth: true,
  },
  {
    key: "reseller",
    label: "Reseller",
    href: "/reseller",
    section: "account",
    accountCategory: "earn",
    accent: "fuchsia",
    auth: true,
  },
];

/** Hidden in customer nav until turned on in admin (Customer panel → Navigation). */
export const NAV_OFF_BY_DEFAULT = new Set([
  "downloads",
  "referral",
  "affiliate",
  "rewards",
  "reseller",
  "support",
  "settings",
]);

export function defaultNavItemEnabled(key: string): boolean {
  return !NAV_OFF_BY_DEFAULT.has(key);
}

export function resolveNavItemEnabled(
  nav: Record<string, { enabled?: boolean } | undefined>,
  key: string,
): boolean {
  const enabled = nav[key]?.enabled;
  if (enabled !== undefined) return enabled;
  return defaultNavItemEnabled(key);
}

let configCache: CustomerPanelConfig | null = null;

export async function getCustomerPanelConfig(): Promise<CustomerPanelConfig> {
  if (configCache) return configCache;
  configCache = await fetchCustomerPanelConfig();
  return configCache;
}

export function invalidatePanelConfig(): void {
  configCache = null;
}

export const PANEL_CONFIG_CHANGED_EVENT = "panel-config-changed";

export function notifyPanelConfigChanged(): void {
  invalidatePanelConfig();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PANEL_CONFIG_CHANGED_EVENT));
  }
}

export function seedPanelConfig(config: CustomerPanelConfig): void {
  configCache = config;
}

export function getCachedPanelConfig(): CustomerPanelConfig | null {
  return configCache;
}

export function filterNav(
  config: CustomerPanelConfig,
): {
  shop: PanelNavItem[];
  blog: PanelNavItem[];
  accountSections: CustomerAccountNavSection[];
} {
  const shop: PanelNavItem[] = [];
  const blog: PanelNavItem[] = [];
  const accountBuckets = new Map<CustomerAccountCategoryId, PanelNavItem[]>(
    CUSTOMER_ACCOUNT_CATEGORIES.map((category) => [category.id, []]),
  );

  for (const item of PANEL_NAV) {
    if (item.key === "settings") continue;
    const navValue = config.nav[item.key];
    const enabled =
      navValue === false
        ? false
        : navValue === true
          ? true
          : defaultNavItemEnabled(item.key);
    if (!enabled) continue;
    if (item.section === "shop") {
      shop.push(item);
      continue;
    }
    if (item.section === "blog") {
      blog.push(item);
      continue;
    }
    if (!item.accountCategory) continue;
    accountBuckets.get(item.accountCategory)?.push(item);
  }

  const accountSections = CUSTOMER_ACCOUNT_CATEGORIES.map((category) => ({
    id: category.id,
    title: category.title,
    sectionClass: category.sectionClass,
    items: accountBuckets.get(category.id) ?? [],
  })).filter((section) => section.items.length > 0);

  return { shop, blog, accountSections };
}
