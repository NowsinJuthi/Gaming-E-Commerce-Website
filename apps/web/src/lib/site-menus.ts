export type SiteMenuLink = {
  label: string;
  href: string;
};

export type SiteFooterColumn = {
  title: string;
  items: SiteMenuLink[];
};

export type SiteMenusConfig = {
  header: SiteMenuLink[];
  headerOthers: SiteMenuLink[];
  footer: SiteFooterColumn[];
};

export const DEFAULT_HEADER_OTHERS_ITEMS: SiteMenuLink[] = [
  { label: "Product Requests", href: "/request-product" },
  { label: "Reviews", href: "/reviews" },
  { label: "Blog", href: "/blog" },
  { label: "Website", href: "/website" },
];

/** @deprecated Use DEFAULT_HEADER_OTHERS_ITEMS or siteMenus.headerOthers */
export const SITE_HEADER_OTHERS_ITEMS = DEFAULT_HEADER_OTHERS_ITEMS;

function headerOthersPaths(items: SiteMenuLink[]): Set<string> {
  return new Set(
    items.map((item) => item.href.split("?")[0] ?? item.href),
  );
}

export function splitStorefrontHeaderNav(
  header: SiteMenuLink[],
  headerOthers: SiteMenuLink[] = DEFAULT_HEADER_OTHERS_ITEMS,
): {
  primary: SiteMenuLink[];
  others: SiteMenuLink[];
} {
  const othersPaths = headerOthersPaths(headerOthers);
  const primary = header.filter((item) => {
    const path = item.href.split("?")[0] ?? item.href;
    return !othersPaths.has(path);
  });
  return { primary, others: headerOthers };
}

export function isHeaderOthersMenuActive(
  items: SiteMenuLink[],
  pathname: string,
  typeParam: string | null,
): boolean {
  return items.some((item) =>
    isSiteMenuLinkActive(item.href, pathname, typeParam),
  );
}

export const DEFAULT_SITE_MENUS: SiteMenusConfig = {
  header: [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/products" },
    { label: "Contact us", href: "/support" },
  ],
  headerOthers: DEFAULT_HEADER_OTHERS_ITEMS,
  footer: [
    {
      title: "Footer Menu",
      items: [
        { label: "Product Requests", href: "/request-product" },
        { label: "All products", href: "/products" },
        { label: "Games Top Up", href: "/products?type=topup" },
        { label: "Gift Cards", href: "/products?type=giftcard" },
        { label: "Reviews", href: "/reviews" },
        { label: "Blog", href: "/blog" },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Sign in", href: "/login" },
        { label: "Dashboard", href: "/dashboard" },
        { label: "My gift cards", href: "/orders" },
      ],
    },
    {
      title: "Useful Links",
      items: [
        { label: "About UniQbd", href: "/about" },
        { label: "Refund And Returns Policy", href: "/refund-and-returns-policy/" },
        { label: "Terms & Conditions", href: "/terms-conditions/" },
        { label: "Disclaimers", href: "/disclaimers/" },
        { label: "Privacy Policy", href: "/privacy-policy/" },
        { label: "Contact us", href: "/support" },
      ],
    },
  ],
};

export function normalizeSiteMenus(
  value?: Partial<SiteMenusConfig> | null,
): SiteMenusConfig {
  const header = (value?.header ?? [])
    .filter((item) => item.label?.trim() && item.href?.trim())
    .map((item) => ({
      label: item.label.trim(),
      href: item.href.trim(),
    }));
  const rawHeaderOthers = value?.headerOthers;
  const headerOthers = (rawHeaderOthers ?? [])
    .filter((item) => item.label?.trim() && item.href?.trim())
    .map((item) => ({
      label: item.label.trim(),
      href: item.href.trim(),
    }));
  const footer = (value?.footer ?? [])
    .filter((column) => column.title?.trim())
    .map((column) => ({
      title: column.title.trim(),
      items: (column.items ?? [])
        .filter((item) => item.label?.trim() && item.href?.trim())
        .map((item) => ({
          label: item.label.trim(),
          href: item.href.trim(),
        })),
    }))
    .filter((column) => column.items.length > 0);

  return {
    header: header.length > 0 ? header : DEFAULT_SITE_MENUS.header,
    headerOthers:
      rawHeaderOthers !== undefined
        ? headerOthers
        : DEFAULT_SITE_MENUS.headerOthers,
    footer: footer.length > 0 ? footer : DEFAULT_SITE_MENUS.footer,
  };
}

export function isHomePath(pathname: string | null | undefined): boolean {
  const normalized = (pathname ?? "").replace(/\/$/, "");
  return normalized === "";
}

export function filterHeaderNavForHome(
  header: SiteMenuLink[],
  pathname: string | null | undefined,
): SiteMenuLink[] {
  if (!isHomePath(pathname)) return header;
  return header.filter((item) => item.href !== "/");
}

export function isSiteMenuLinkActive(
  href: string,
  pathname: string,
  typeParam: string | null,
): boolean {
  const pathOnly = href.split("?")[0] ?? href;
  const query = href.includes("?") ? href.split("?")[1] ?? "" : "";
  const params = new URLSearchParams(query);
  const hrefType = params.get("type");

  if (pathOnly === "/") return pathname === "/";
  if (pathOnly === "/products") {
    if (hrefType) {
      return pathname === "/products" && typeParam === hrefType;
    }
    return (
      (pathname === "/products" && !typeParam) ||
      pathname === "/search" ||
      pathname.startsWith("/brand/")
    );
  }
  if (pathOnly === "/blog") {
    return pathname === "/blog" || pathname.startsWith("/blog/");
  }
  if (pathOnly === "/request-product") {
    return pathname === "/request-product";
  }
  if (pathOnly === "/reviews") {
    return pathname === "/reviews";
  }
  if (pathOnly === "/website") {
    return pathname === "/website";
  }
  if (pathOnly === "/support") {
    return (
      pathname === "/support" ||
      pathname.startsWith("/chat") ||
      pathname.startsWith("/tickets")
    );
  }
  if (pathOnly === "/refund-and-returns-policy") {
    return (
      pathname === "/refund-and-returns-policy" ||
      pathname === "/refund-and-returns-policy/"
    );
  }
  if (pathOnly === "/terms-conditions") {
    return (
      pathname === "/terms-conditions" ||
      pathname === "/terms-conditions/"
    );
  }
  if (pathOnly === "/privacy-policy") {
    return (
      pathname === "/privacy-policy" ||
      pathname === "/privacy-policy/"
    );
  }
  if (pathOnly === "/disclaimers") {
    return (
      pathname === "/disclaimers" ||
      pathname === "/disclaimers/"
    );
  }
  if (href.includes("?")) {
    return pathname === pathOnly && typeParam === hrefType;
  }
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}
