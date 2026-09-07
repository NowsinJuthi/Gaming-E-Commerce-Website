export type EmailSettingsNavItem = {
  href: string;
  navLabel: string;
  pageTitle: string;
  pageDescription: string;
  isActive: (pathname: string) => boolean;
};

export const EMAIL_SMTP_NAV: EmailSettingsNavItem = {
  href: "/admin/settings/email",
  navLabel: "SMTP",
  pageTitle: "Email / SMTP",
  pageDescription:
    "Configure mail transport, sender identity, and delivery testing",
  isActive: (pathname) => pathname === "/admin/settings/email",
};

export const EMAIL_TEMPLATES_NAV: EmailSettingsNavItem = {
  href: "/admin/settings/email/templates",
  navLabel: "Email Template Customize",
  pageTitle: "Email Template Customize and Design",
  pageDescription:
    "Professional template library for automated store communications",
  isActive: (pathname) =>
    pathname === "/admin/settings/email/templates" ||
    pathname.startsWith("/admin/settings/email/templates/"),
};

export const EMAIL_SETTINGS_NAV_ITEMS = [
  EMAIL_SMTP_NAV,
  EMAIL_TEMPLATES_NAV,
] as const;

const EMAIL_HEADER_LOGO_META = {
  pageTitle: "Email Header Logo",
  pageDescription:
    "Header logo, footer, and accent color for transactional emails",
};

export function getEmailSettingsPageMeta(pathname: string | null): {
  title: string;
  description: string;
} | null {
  if (!pathname?.startsWith("/admin/settings/email")) return null;

  if (EMAIL_SMTP_NAV.isActive(pathname) && pathname === EMAIL_SMTP_NAV.href) {
    return {
      title: EMAIL_SMTP_NAV.pageTitle,
      description: EMAIL_SMTP_NAV.pageDescription,
    };
  }

  if (pathname === "/admin/settings/email/templates/branding") {
    return {
      title: EMAIL_HEADER_LOGO_META.pageTitle,
      description: EMAIL_HEADER_LOGO_META.pageDescription,
    };
  }

  const templateDetailMatch = pathname.match(
    /^\/admin\/settings\/email\/templates\/([^/]+)$/,
  );
  if (
    templateDetailMatch &&
    templateDetailMatch[1] !== "branding"
  ) {
    return null;
  }

  if (EMAIL_TEMPLATES_NAV.isActive(pathname)) {
    return {
      title: EMAIL_TEMPLATES_NAV.pageTitle,
      description: EMAIL_TEMPLATES_NAV.pageDescription,
    };
  }

  return {
    title: EMAIL_SMTP_NAV.pageTitle,
    description: EMAIL_SMTP_NAV.pageDescription,
  };
}

export function getActiveEmailSettingsNavItem(
  pathname: string | null,
): EmailSettingsNavItem {
  if (!pathname) return EMAIL_SMTP_NAV;
  return (
    EMAIL_SETTINGS_NAV_ITEMS.find((item) => item.isActive(pathname)) ??
    EMAIL_SMTP_NAV
  );
}
