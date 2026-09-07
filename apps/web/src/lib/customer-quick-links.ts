import type { AdminQuickLink } from "@/components/admin/admin-quick-links";

export const DASHBOARD_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/products", label: "Browse store" },
  { href: "/orders", label: "My Order history" },
  { href: "/wallet", label: "Wallet" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/chat", label: "Live Support" },
];

export const WALLET_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/orders", label: "My Order history" },
  { href: "/products", label: "Browse store" },
  { href: "/chat", label: "Live Support" },
  { href: "/settings", label: "Settings" },
];

export const ORDERS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/wallet", label: "Wallet" },
  { href: "/products", label: "Browse store" },
  { href: "/downloads", label: "Downloads" },
  { href: "/chat", label: "Live Support" },
];

export const DOWNLOADS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/orders", label: "My Order history" },
  { href: "/products", label: "Browse store" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/chat", label: "Live Support" },
];

export const WISHLIST_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/orders", label: "My Order history" },
  { href: "/products", label: "Browse store" },
  { href: "/cart", label: "Cart" },
  { href: "/chat", label: "Live Support" },
];

export const REFERRAL_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/affiliate", label: "Affiliate dashboard" },
  { href: "/rewards", label: "Rewards" },
  { href: "/products", label: "Browse store" },
  { href: "/chat", label: "Live Support" },
];

export const AFFILIATE_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/referral", label: "Referral" },
  { href: "/wallet", label: "Wallet" },
  { href: "/rewards", label: "Rewards" },
  { href: "/chat", label: "Live Support" },
];

export const REWARDS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/orders", label: "My Order history" },
  { href: "/wallet", label: "Wallet" },
  { href: "/referral", label: "Referral" },
  { href: "/chat", label: "Live Support" },
];

export const CHAT_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/support", label: "Support center" },
  { href: "/tickets", label: "Support tickets" },
  { href: "/orders", label: "My Order history" },
  { href: "/settings", label: "Settings" },
];

export const NOTIFICATIONS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/orders", label: "My Order history" },
  { href: "/settings", label: "Settings" },
  { href: "/chat", label: "Live Support" },
  { href: "/wallet", label: "Wallet" },
];

export const ALL_NOTIFICATIONS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
  { href: "/orders", label: "My Order history" },
  { href: "/chat", label: "Live Support" },
];

export const SETTINGS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/profile", label: "Profile Settings" },
  { href: "/notifications", label: "Notifications" },
  { href: "/chat", label: "Live Support" },
  { href: "/wallet", label: "Wallet" },
];

export const PROFILE_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/settings", label: "Account settings" },
  { href: "/orders", label: "My Order history" },
  { href: "/notifications", label: "Notifications" },
  { href: "/chat", label: "Live Support" },
];

export const RESELLER_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/wallet", label: "Wallet" },
  { href: "/orders", label: "My Order history" },
  { href: "/chat", label: "Live Support" },
  { href: "/settings", label: "Settings" },
];
