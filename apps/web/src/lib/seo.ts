import type { Metadata } from "next";
import type { Route } from "next";
import { getSeoConfig, type PublicSeoConfig } from "@/lib/api";

/**
 * Centralized SEO configuration and metadata helpers.
 *
 * All page metadata (titles, descriptions, canonicals, Open Graph, Twitter)
 * flows through here so the storefront has one consistent, production-ready SEO
 * surface. URLs are emitted absolute (resolved against {@link SITE_URL}) so they
 * are valid in sitemaps, canonical tags, and social cards.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://uniqbd.com"
).replace(/\/$/, "");

export const SITE_NAME = "UniQbd";

export const SITE_COPYRIGHT = "© 2020 UniQbd. All Rights Reserved.";

export const SITE_DESCRIPTION =
  "Buy game top-ups, software licenses, gift cards and subscriptions with instant delivery on UniQbd — Bangladesh's trusted digital goods marketplace.";

export const SITE_LOCALE = "en_US";

export const TWITTER_HANDLE = "@uniqbd";

/** Default social/share image — generated on the fly via `app/opengraph-image.tsx`. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`;

/** Square brand mark — served via stable `/favicon` route. */
export const SITE_ICON = `${SITE_URL}/favicon`;

/**
 * Top-level paths that are real routes (or otherwise must never be treated as a
 * product slug). The root-level product route (`/[slug]`) consults this set to
 * fast-404 reserved words, and the sitemap uses it to avoid emitting colliding
 * URLs. Next.js route precedence already resolves these to their static routes;
 * this is defense-in-depth + canonical hygiene.
 */
export const RESERVED_SLUGS = new Set<string>([
  "products",
  "product",
  "category",
  "categories",
  "brand",
  "brands",
  "search",
  "cart",
  "checkout",
  "login",
  "register",
  "verify-email",
  "forgot-password",
  "reset-password",
  "dashboard",
  "orders",
  "order",
  "wallet",
  "wishlist",
  "profile",
  "settings",
  "affiliate",
  "referral",
  "rewards",
  "support",
  "about",
  "contact",
  "refund-and-returns-policy",
  "terms-conditions",
  "privacy-policy",
  "disclaimers",
  "website",
  "blog",
  "chat",
  "notifications",
  "reseller",
  "tickets",
  "downloads",
  "admin",
  "api",
  "sitemap.xml",
  "robots.txt",
  "manifest.webmanifest",
  "favicon.ico",
  "_next",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** Resolve a path (or absolute URL) to an absolute, canonical URL. */
export function absoluteUrl(path = "/", baseUrl?: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = (baseUrl ?? SITE_URL).replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Canonical path for a product (root-level slug, no `/products/` prefix). */
export function productPath(slug: string): Route {
  return `/${slug}` as Route;
}

export function categoryPath(slug: string): Route {
  return `/${slug}` as Route;
}

export function brandPath(slug: string): Route {
  return `/brand/${slug}` as Route;
}

export function blogPath(): Route {
  return "/blog" as Route;
}

export function blogPostPath(slug: string): Route {
  return `/blog/${slug}` as Route;
}

export function blogCategoryPath(slug: string): Route {
  return `/blog/category/${slug}` as Route;
}

/** Collapse whitespace, strip HTML tags, and truncate to a meta-friendly length. */
export function toMetaText(input: string | undefined | null, max = 160): string {
  if (!input) return "";
  const text = input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Static fallback used when the SEO settings API is unavailable. */
export const DEFAULT_SEO_CONFIG: PublicSeoConfig = {
  siteTitle: `${SITE_NAME} — Digital Goods Marketplace`,
  siteDescription: SITE_DESCRIPTION,
  keywords: [],
  canonicalDomain: SITE_URL,
  robots: { index: true, follow: true },
  verification: { google: "", bing: "" },
  analytics: { googleAnalyticsId: "", gtmId: "", facebookPixelId: "" },
  homepage: {
    title: "",
    description: "",
    keywords: [],
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
  },
  social: { facebook: "", instagram: "", youtube: "", twitter: "", discord: "" },
  schema: {
    organization: true,
    website: true,
    product: true,
    faq: false,
    faqItems: [],
  },
  staticPages: [],
};

/** Server-side: fetch the admin-managed SEO config (cached, resilient). */
export function fetchSeoConfig(): Promise<PublicSeoConfig> {
  return getSeoConfig(DEFAULT_SEO_CONFIG);
}

/** Social profile URLs as a clean `sameAs` array. */
export function socialSameAs(social: PublicSeoConfig["social"]): string[] {
  return [
    social.facebook,
    social.instagram,
    social.youtube,
    social.twitter,
    social.discord,
  ].filter((u) => Boolean(u && u.trim()));
}

type BuildMetadataInput = {
  title?: string;
  /** When true, the title is emitted verbatim (bypasses the layout `%s` template). */
  absoluteTitle?: boolean;
  description?: string;
  /** Canonical path or absolute URL for this page. */
  path?: string;
  /** Absolute canonical URL override (takes precedence over path). */
  canonicalUrl?: string;
  images?: Array<string | { url: string; alt?: string; width?: number; height?: number }>;
  keywords?: string[];
  /** Set true for pages that must not be indexed (e.g. authenticated areas). */
  noIndex?: boolean;
  type?: "website" | "article";
  /** ISO date for article published time (Open Graph). */
  publishedTime?: string;
  /** ISO date for article modified time (Open Graph). */
  modifiedTime?: string;
};

/**
 * Builds a complete, consistent {@link Metadata} object: title, description,
 * canonical + hreflang alternates, Open Graph, and Twitter card. Pass a `path`
 * to get a self-referencing canonical (the single most important on-page SEO
 * signal for de-duplication).
 */
export function buildMetadata({
  title,
  absoluteTitle = false,
  description,
  path = "/",
  canonicalUrl,
  images,
  keywords,
  noIndex = false,
  type = "website",
  publishedTime,
  modifiedTime,
}: BuildMetadataInput): Metadata {
  const canonical = canonicalUrl?.trim()
    ? absoluteUrl(canonicalUrl.trim())
    : absoluteUrl(path);
  const desc = toMetaText(description ?? SITE_DESCRIPTION, 200);
  const ogImages = (images && images.length > 0 ? images : [DEFAULT_OG_IMAGE]).map(
    (img) => (typeof img === "string" ? { url: absoluteUrl(img) } : { ...img, url: absoluteUrl(img.url) }),
  );

  const openGraph: Metadata["openGraph"] = {
    type,
    siteName: SITE_NAME,
    title: title ?? SITE_NAME,
    description: desc,
    url: canonical,
    locale: SITE_LOCALE,
    images: ogImages,
  };

  if (type === "article") {
    if (publishedTime) {
      (openGraph as Record<string, unknown>).publishedTime = publishedTime;
    }
    if (modifiedTime) {
      (openGraph as Record<string, unknown>).modifiedTime = modifiedTime;
    }
  }

  return {
    title: title && absoluteTitle ? { absolute: title } : title,
    description: desc,
    keywords: keywords && keywords.length > 0 ? keywords : undefined,
    alternates: {
      canonical,
      languages: {
        "en-US": canonical,
        "x-default": canonical,
      },
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph,
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      title: title ?? SITE_NAME,
      description: desc,
      images: ogImages.map((i) => i.url),
    },
  };
}
