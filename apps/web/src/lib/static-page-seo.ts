import type { Metadata } from "next";

import type { PublicSeoConfig } from "@/lib/api";
import { buildMetadata } from "@/lib/seo";

export type StaticPageSeoRegistryEntry = {
  path: string;
  label: string;
  title: string;
  description: string;
  keywords?: string[];
};

export type StaticPageSeoEntry = StaticPageSeoRegistryEntry & {
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  noIndex: boolean;
};

export const HOMEPAGE_SEO_PATH = "/";

export const STATIC_PAGE_SEO_REGISTRY: StaticPageSeoRegistryEntry[] = [
  {
    path: HOMEPAGE_SEO_PATH,
    label: "Homepage",
    title: "Homepage",
    description:
      "Shop game top-ups, gift cards, software licenses and digital subscriptions with instant delivery on {siteName}.",
  },
  {
    path: "/about",
    label: "About Us",
    title: "About Us",
    description:
      "Learn about {siteName} — Bangladesh's trusted digital marketplace for gaming top-ups, gift cards, and instant delivery.",
  },
  {
    path: "/contact",
    label: "Contact Us",
    title: "Contact Us",
    description: "Contact {siteName} for support and inquiries.",
  },
  {
    path: "/website",
    label: "Website Packages",
    title: "Website Packages",
    description:
      "Professional website packages from {siteName} — Starter, Business, and Enterprise solutions for your business.",
  },
  {
    path: "/privacy-policy/",
    label: "Privacy Policy",
    title: "Privacy Policy",
    description:
      "Read {siteName}'s Privacy Policy — how we collect, use, and protect your information.",
  },
  {
    path: "/terms-conditions/",
    label: "Terms & Conditions",
    title: "Terms & Conditions",
    description:
      "Read {siteName}'s Terms of Service for using our digital marketplace in Bangladesh.",
  },
  {
    path: "/disclaimers/",
    label: "Disclaimers",
    title: "Disclaimers",
    description:
      "Read {siteName}'s disclaimers for website use, gift cards, direct top-ups, and related services.",
  },
  {
    path: "/refund-and-returns-policy/",
    label: "Refund & Returns Policy",
    title: "Refund And Returns Policy",
    description:
      "Read {siteName}'s refund, return, exchange, and gift policy for digital purchases in Bangladesh.",
  },
  {
    path: "/request-product",
    label: "Request Product",
    title: "Request New Product",
    description:
      "Can't find a product on {siteName}? Request it and we'll try to add it for you.",
  },
  {
    path: "/products",
    label: "Shop / Products",
    title: "All Products",
    description:
      "Browse all digital products on {siteName} — game top-ups, gift cards, software licenses and subscriptions with instant delivery.",
    keywords: [
      "game top-ups",
      "gift cards",
      "digital goods",
      "Bangladesh",
    ],
  },
  {
    path: "/blog",
    label: "Blog",
    title: "Blog",
    description:
      "Read guides, updates, and digital shopping tips on the {siteName} blog.",
    keywords: ["blog", "guides", "digital goods", "gaming", "gift cards", "Bangladesh"],
  },
  {
    path: "/reviews",
    label: "Reviews",
    title: "Reviews",
    description: "Read verified customer reviews for digital products on {siteName}.",
    keywords: [
      "reviews",
      "customer reviews",
      "digital goods",
      "gaming",
      "gift cards",
      "Bangladesh",
    ],
  },
];

export function normalizeStaticPagePath(path: string): string {
  if (path === "/") return "/";
  const trimmed = path.trim();
  if (!trimmed) return "/";
  if (trimmed.endsWith("/") && trimmed.length > 1) return trimmed;
  return trimmed.replace(/\/+$/, "") || trimmed;
}

function formatTemplate(text: string, siteName: string): string {
  return text.replace(/\{siteName\}/g, siteName);
}

export function createDefaultStaticPages(): StaticPageSeoEntry[] {
  return STATIC_PAGE_SEO_REGISTRY.map((entry) => ({
    ...entry,
    keywords: entry.keywords ?? [],
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    noIndex: false,
  }));
}

export function mergeStaticPages(
  stored?: Array<Partial<StaticPageSeoEntry> & { path: string; label?: string }> | null,
): StaticPageSeoEntry[] {
  const byPath = new Map(
    (stored ?? []).map((page) => [normalizeStaticPagePath(page.path), page]),
  );

  return STATIC_PAGE_SEO_REGISTRY.map((entry) => {
    const saved = byPath.get(normalizeStaticPagePath(entry.path));
    return {
      path: entry.path,
      label: saved?.label?.trim() || entry.label,
      title: saved?.title?.trim() || entry.title,
      description: saved?.description?.trim() || entry.description,
      keywords: saved?.keywords?.length ? saved.keywords : (entry.keywords ?? []),
      ogTitle: saved?.ogTitle?.trim() ?? "",
      ogDescription: saved?.ogDescription?.trim() ?? "",
      ogImage: saved?.ogImage?.trim() ?? "",
      noIndex: saved?.noIndex ?? false,
    };
  });
}

export function buildStaticPageMetadata(
  path: string,
  config: PublicSeoConfig,
  options?: {
    noIndex?: boolean;
    title?: string;
    description?: string;
    keywords?: string[];
  },
): Metadata {
  const normalized = normalizeStaticPagePath(path);

  if (normalized === HOMEPAGE_SEO_PATH) {
    const home = config.homepage;
    return buildMetadata({
      title: home.title || config.siteTitle,
      absoluteTitle: true,
      description: home.description || config.siteDescription,
      keywords: home.keywords.length > 0 ? home.keywords : config.keywords,
      images: home.ogImage ? [home.ogImage] : undefined,
      path: HOMEPAGE_SEO_PATH,
    });
  }

  const pages = mergeStaticPages(config.staticPages);
  const page = pages.find((item) => normalizeStaticPagePath(item.path) === normalized);
  const registry = STATIC_PAGE_SEO_REGISTRY.find(
    (item) => normalizeStaticPagePath(item.path) === normalized,
  );
  const siteName = config.siteTitle || "UniQbd";

  const title = page?.title?.trim() || options?.title || registry?.title || "Page";
  const description = formatTemplate(
    page?.description?.trim() ||
      options?.description ||
      registry?.description ||
      config.siteDescription,
    siteName,
  );
  const keywords =
    page?.keywords && page.keywords.length > 0
      ? page.keywords
      : options?.keywords && options.keywords.length > 0
        ? options.keywords
        : registry?.keywords;
  const noIndex = options?.noIndex ?? page?.noIndex ?? false;
  const ogImage = page?.ogImage?.trim();

  return buildMetadata({
    title,
    description,
    path: registry?.path ?? normalized,
    keywords,
    noIndex,
    images: ogImage ? [ogImage] : undefined,
  });
}
