import {
  absoluteUrl,
  SITE_DESCRIPTION,
  SITE_ICON,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

type Json = Record<string, unknown>;

export type OrganizationSchemaOptions = {
  name?: string;
  url?: string;
  description?: string;
  logoUrl?: string;
  /** Social profile URLs (Knowledge Graph `sameAs`). */
  sameAs?: string[];
};

/** Organization schema — establishes the brand entity for Google Knowledge Graph. */
export function organizationSchema(opts: OrganizationSchemaOptions = {}): Json {
  const name = opts.name || SITE_NAME;
  const url = opts.url || SITE_URL;
  const sameAs = (opts.sameAs ?? []).filter(Boolean);
  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo: opts.logoUrl ? absoluteUrl(opts.logoUrl) : SITE_ICON,
    description: opts.description || SITE_DESCRIPTION,
  };
  if (sameAs.length > 0) schema.sameAs = sameAs;
  return schema;
}

/** WebSite schema with a SearchAction so Google can render a sitelinks search box. */
export function websiteSchema(opts: { name?: string; url?: string } = {}): Json {
  const name = opts.name || SITE_NAME;
  const url = opts.url || SITE_URL;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export type BreadcrumbItem = { name: string; path: string };

export type SchemaSiteContext = {
  /** Admin canonical domain — keeps JSON-LD URLs aligned with metadataBase. */
  siteUrl?: string;
};

export function breadcrumbSchema(
  items: BreadcrumbItem[],
  ctx: SchemaSiteContext = {},
): Json {
  const siteUrl = ctx.siteUrl;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, siteUrl),
    })),
  };
}

export type ProductReviewSchemaEntry = {
  /** Customer display name. */
  author: string;
  /** Star rating, 1–5. */
  rating: number;
  /** Review text. */
  body: string;
  /** ISO date string of when the review was written. */
  date?: string;
  /** Optional review headline. */
  title?: string;
};

export type ProductSchemaInput = {
  name: string;
  description?: string;
  images?: string[];
  sku?: string;
  /** Stable product identifier (Mongo _id) — used as productID and SKU fallback. */
  productId?: string;
  brandName?: string;
  /** Category name, e.g. "Gift Cards". */
  category?: string;
  url: string;
  price: number;
  currency: string;
  inStock: boolean;
  rating?: { avg: number; count: number };
  /** Published customer reviews (already filtered — never pass pending/deleted ones). */
  reviews?: ProductReviewSchemaEntry[];
  /** Admin canonical domain — keeps JSON-LD URLs aligned with metadataBase. */
  siteUrl?: string;
};

/** `priceValidUntil` one year out — silences the Rich Results "missing field" warning. */
function priceValidUntil(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Product schema with Offer (price + availability), AggregateRating and
 * individual customer Review entries for Google Product Rich Results.
 */
export function productSchema(input: ProductSchemaInput): Json {
  const siteUrl = input.siteUrl;
  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description || SITE_DESCRIPTION,
    image:
      input.images && input.images.length > 0
        ? input.images.map((i) => absoluteUrl(i, siteUrl))
        : [absoluteUrl("/opengraph-image", siteUrl)],
    url: absoluteUrl(input.url, siteUrl),
    offers: {
      "@type": "Offer",
      price: input.price,
      priceCurrency: input.currency,
      priceValidUntil: priceValidUntil(),
      itemCondition: "https://schema.org/NewCondition",
      availability: input.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: absoluteUrl(input.url, siteUrl),
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };
  const sku = input.sku || input.productId;
  if (sku) schema.sku = sku;
  if (input.productId) schema.productID = input.productId;
  if (input.brandName) {
    schema.brand = { "@type": "Brand", name: input.brandName };
  }
  if (input.category) schema.category = input.category;
  if (input.rating && input.rating.count > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(input.rating.avg.toFixed(1)),
      reviewCount: input.rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }
  const reviews = (input.reviews ?? []).filter(
    (r) => r.body.trim() && r.rating >= 1 && r.rating <= 5,
  );
  if (reviews.length > 0) {
    schema.review = reviews.map((r) => {
      const review: Json = {
        "@type": "Review",
        author: { "@type": "Person", name: r.author || "Customer" },
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        },
        reviewBody: r.body,
      };
      if (r.title) review.name = r.title;
      if (r.date) {
        const parsed = new Date(r.date);
        if (!Number.isNaN(parsed.getTime())) {
          review.datePublished = parsed.toISOString().slice(0, 10);
        }
      }
      return review;
    });
  }
  return schema;
}

export type ItemListEntry = { name: string; path: string; image?: string };

/** ItemList schema for category / catalog listing pages. */
export function itemListSchema(
  name: string,
  entries: ItemListEntry[],
  ctx: SchemaSiteContext = {},
): Json {
  const siteUrl = ctx.siteUrl;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(entry.path, siteUrl),
      name: entry.name,
      ...(entry.image ? { image: absoluteUrl(entry.image, siteUrl) } : {}),
    })),
  };
}

export type FaqEntry = { question: string; answer: string };

export function faqSchema(entries: FaqEntry[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

export type BlogArticleSchemaInput = {
  title: string;
  description?: string;
  url: string;
  canonicalUrl?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  keywords?: string[];
  articleSection?: string;
  siteUrl?: string;
};

export function blogArticleSchema(input: BlogArticleSchemaInput): Json {
  const siteUrl = input.siteUrl;
  const pageUrl = absoluteUrl(input.url, siteUrl);
  const canonical = input.canonicalUrl?.trim()
    ? absoluteUrl(input.canonicalUrl.trim(), siteUrl)
    : pageUrl;
  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    url: pageUrl,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: {
      "@type": "Person",
      name: input.authorName || SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: SITE_ICON,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
  };
  if (input.image) {
    schema.image = absoluteUrl(input.image, siteUrl);
  }
  if (input.keywords?.length) {
    schema.keywords = input.keywords.join(", ");
  }
  if (input.articleSection?.trim()) {
    schema.articleSection = input.articleSection.trim();
  }
  return schema;
}
