export type AdminQuickLink = { href: string; label: string };

export const CATALOG_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/admin/products", label: "All products" },
  { href: "/admin/products/new", label: "Add product" },
  { href: "/admin/products/categories", label: "Categories" },
  { href: "/admin/products/brands", label: "Brands" },
  { href: "/admin/products/stock", label: "Stock" },
  { href: "/admin/products/reviews", label: "Reviews" },
];

export const SALES_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/admin/sales/orders", label: "Orders" },
  { href: "/admin/sales/analytics", label: "Sales Analytics" },
  { href: "/admin/sales/payments", label: "Payments" },
  { href: "/admin/sales/refunds", label: "Refunds" },
  { href: "/admin/sales/coupons", label: "Coupons" },
  { href: "/admin/sales/vouchers", label: "Vouchers" },
  { href: "/admin/sales/sms-logs", label: "SMS logs" },
  { href: "/admin/sales/email-logs", label: "Email logs" },
];

export const CUSTOMERS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/admin/customers", label: "All customers" },
  { href: "/admin/customers/kyc", label: "KYC" },
  { href: "/admin/customers/resellers", label: "Resellers" },
  { href: "/admin/customers/affiliates", label: "Affiliates" },
];

export const SUPPORT_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/chat", label: "Live chat" },
  { href: "/admin/chat/settings", label: "Live chat settings" },
  { href: "/admin/chat/status", label: "System status" },
];

export const LIVE_CHAT_SETTINGS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/admin/chat", label: "Live chat" },
  { href: "/admin/chat/settings", label: "Live chat settings" },
  { href: "/admin/chat/status", label: "System status" },
  { href: "/admin/saved-replies", label: "Saved replies" },
  { href: "/admin/tickets", label: "Tickets" },
];

export const SETTINGS_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/payments", label: "Payments" },
  { href: "/admin/settings/delivery", label: "Delivery" },
  { href: "/admin/settings/telegram", label: "Telegram bot" },
  { href: "/admin/settings/seo", label: "SEO" },
  { href: "/admin/settings/website", label: "Website pricing" },
  { href: "/admin/settings/security", label: "Security" },
  { href: "/admin/settings/payments?tab=mfs", label: "MFS gateways" },
];

export const EMAIL_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/admin/settings/email", label: "SMTP" },
  { href: "/admin/settings/email/templates", label: "Templates" },
  { href: "/admin/settings/email/templates/branding", label: "Header logo" },
];
